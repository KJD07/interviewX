from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count, F, Q, Window
from django.db.models.functions import RowNumber
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.companies.models import InterviewQuestion
from apps.subscriptions.plans import effective_plan

from . import feeds
from .graphs import quota, run_ats_check
from .matching import candidate_filter, match_score, signals_for
from .models import CandidateProfile, Job, JobApplication, JobFeedState, JobSnapshot, SavedJob
from .practice import score_answer
from .profile_parser import parse_resume
from .resume_parser import ResumeParseError, extract_text
from .serializers import (
    ApplicationUpdateSerializer, CandidateProfileSerializer, ManualApplicationSerializer, job_dict, tracked_dict,
)

PAGE_SIZE = 20
MATCH_POOL = 2000  # newest candidate jobs scored in Python for "Best match"
POSTED_WITHIN = {"1", "3", "7", "30"}
COMPANY_CAP = 3  # jobs per company per list, so one big employer can't fill whole pages
MAX_TERMS = 10   # roles / locations accepted per search
EXP_TOP = 15     # the experience slider's last stop means "15+" (no upper bound)


def _profile(user):
    return CandidateProfile.objects.filter(user=user).first()


def _tracking(user, job_ids):
    saved = set(SavedJob.objects.filter(user=user, job_id__in=job_ids).values_list("job_id", flat=True))
    applied = dict(JobApplication.objects.filter(user=user, job_id__in=job_ids).values_list("job_id", "status"))
    return saved, applied


def _terms(params, key):
    """Repeated (?q=a&q=b) or comma-free multi-value param -> cleaned, de-duplicated terms."""
    seen, out = set(), []
    for raw in params.getlist(key):
        t = raw.strip()
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    return out[:MAX_TERMS]


def _int_param(params, key, lo, hi):
    try:
        return max(lo, min(hi, int(params.get(key))))
    except (TypeError, ValueError):
        return None


def _filtered_jobs(params):
    qs = Job.objects.defer("description")  # list views never show it; it's most of each row
    if params.get("region") == "india":
        qs = qs.filter(in_india=True)
    roles = Q()  # any of the roles / skills / companies
    for t in _terms(params, "q"):
        roles |= Q(title__icontains=t) | Q(company__icontains=t) | Q(skills__contains=[t.lower()])
    qs = qs.filter(roles)
    places = Q()  # any of the locations
    for t in _terms(params, "location"):
        places |= Q(location__icontains=t)
    qs = qs.filter(places)
    company = params.get("company", "").strip()
    if company:
        qs = qs.filter(company__iexact=company)
    modes = [m for m in params.get("work_mode", "").split(",") if m in Job.WorkMode.values]
    if modes:
        qs = qs.filter(work_mode__in=modes)
    levels = [lv for lv in params.get("level", "").split(",") if lv in Job.Level.values]
    if levels:
        qs = qs.filter(level__in=levels)
    # Experience range in years: keep jobs whose asked-for range overlaps it.
    lo, hi = _int_param(params, "exp_min", 0, EXP_TOP), _int_param(params, "exp_max", 0, EXP_TOP)
    if lo is not None and hi is not None and lo > hi:
        lo, hi = hi, lo
    if lo:
        qs = qs.filter(Q(exp_max__isnull=True) | Q(exp_max__gte=lo))
    if hi is not None and hi < EXP_TOP:
        qs = qs.filter(Q(exp_min__isnull=True) | Q(exp_min__lte=hi))
    posted = params.get("posted", "")
    if posted in POSTED_WITHIN:
        qs = qs.filter(posted_at__gte=timezone.now() - timedelta(days=int(posted)))
    return qs


def _cap_per_company(qs):
    """Newest COMPANY_CAP jobs of each company, still newest-first overall."""
    ranked = qs.annotate(rn=Window(RowNumber(), partition_by=F("company"), order_by=F("posted_at").desc()))
    return qs.model.objects.filter(pk__in=ranked.filter(rn__lte=COMPANY_CAP).values("pk")).defer("description")


def _more_by_company(qs, rows):
    """{company: jobs beyond the cap} for the companies on this page (the "see all" count)."""
    names = {j.company for _, j in rows}
    totals = dict(qs.filter(company__in=names).order_by().values_list("company").annotate(n=Count("pk")))
    return {c: max(0, n - COMPANY_CAP) for c, n in totals.items()}


class JobListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        feeds.refresh_if_stale()
        params = request.query_params
        qs = _filtered_jobs(params)
        try:
            page = max(1, int(params.get("page", 1)))
        except ValueError:
            page = 1
        start, end = (page - 1) * PAGE_SIZE, page * PAGE_SIZE
        sig = signals_for(_profile(request.user))
        sort = "match" if params.get("sort") == "match" and sig.usable else "recent"
        # "Best match" is a filter (jobs relevant to the profile), independent of the sort order.
        best_match = params.get("best_match") == "1" and sig.usable
        if best_match or sort == "match":
            qs = qs.filter(candidate_filter(sig))
        capped = not params.get("company", "").strip()  # drilling into one company lifts the cap

        if sort == "match":
            pool = list(qs[:MATCH_POOL])
            scored = sorted(((match_score(j, sig), j) for j in pool), key=lambda p: (-p[0], -p[1].posted_at.timestamp()))
            if capped:
                kept, per_company = [], {}
                for row in scored:
                    per_company[row[1].company] = per_company.get(row[1].company, 0) + 1
                    if per_company[row[1].company] <= COMPANY_CAP:
                        kept.append(row)
                scored = kept
            total = len(scored)
            page_rows = scored[start:end]
        else:
            listing = _cap_per_company(qs) if capped else qs
            total = listing.count()
            page_rows = [(match_score(j, sig), j) for j in listing[start:end]]
        more = _more_by_company(qs, page_rows) if capped else {}

        saved, applied = _tracking(request.user, [j.id for _, j in page_rows])
        state = JobFeedState.objects.filter(pk=1).first()
        limit, used = quota(request.user)
        return Response({
            "results": [job_dict(j, saved=j.id in saved, application=applied.get(j.id), match=m, company_more=more.get(j.company, 0))
                        for m, j in page_rows],
            "count": total, "page": page, "page_size": PAGE_SIZE, "sort": sort, "best_match": best_match,
            "company_cap": COMPANY_CAP if capped else None,
            "last_refreshed_at": (state.last_finished_at or state.last_refreshed_at) if state else None,
            "refreshing": feeds.is_sweeping(state),
            "stats": {"jobs": state.jobs_count if state else 0, "companies": state.companies_count if state else 0,
                      "india_jobs": state.india_jobs_count if state else 0,
                      "india_companies": state.india_companies_count if state else 0},
            "has_profile": sig.usable,
            "ats_quota": {"limit": limit, "used": used},
        })


class JobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        job = Job.objects.filter(pk=job_id).first()
        if not job:
            return Response({"detail": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        feeds.ensure_description(job)
        saved, applied = _tracking(request.user, [job.id])
        sig = signals_for(_profile(request.user))
        return Response(job_dict(job, with_description=True, saved=job.id in saved,
                                 application=applied.get(job.id), match=match_score(job, sig)))


class JobSaveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_id):
        job = Job.objects.filter(pk=job_id).first()
        if not job:
            return Response({"detail": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        SavedJob.objects.get_or_create(user=request.user, job=job, defaults=JobSnapshot.snapshot_of(job))
        return Response({"saved": True})

    def delete(self, request, job_id):
        SavedJob.objects.filter(user=request.user, job_id=job_id).delete()
        return Response({"saved": False})


class SavedJobListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = SavedJob.objects.filter(user=request.user).select_related("job")
        return Response([tracked_dict(r) for r in rows])

    def delete(self, request):
        """Remove a saved row by its own id (works after the posting closed)."""
        SavedJob.objects.filter(user=request.user, pk=request.query_params.get("id")).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ApplicationListView(APIView):
    """GET: the candidate's tracker. POST {job_id} records applying to a live
    job (idempotent); POST {title, company, ...} tracks a role found elsewhere."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = JobApplication.objects.filter(user=request.user).select_related("job")
        return Response([tracked_dict(r) for r in rows])

    def post(self, request):
        job_id = request.data.get("job_id")
        if job_id:
            job = Job.objects.filter(pk=job_id).first()
            if not job:
                return Response({"detail": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
            try:
                with transaction.atomic():
                    app, created = JobApplication.objects.get_or_create(
                        user=request.user, job=job, defaults=JobSnapshot.snapshot_of(job))
            except IntegrityError:  # double-click race
                app, created = JobApplication.objects.get(user=request.user, job=job), False
            return Response(tracked_dict(app), status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        ser = ManualApplicationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        app = JobApplication.objects.create(user=request.user, **ser.validated_data)
        return Response(tracked_dict(app), status=status.HTTP_201_CREATED)


class ApplicationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        return JobApplication.objects.filter(user=request.user, pk=pk).select_related("job").first()

    def patch(self, request, pk):
        app = self._get(request, pk)
        if not app:
            return Response({"detail": "Application not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = ApplicationUpdateSerializer(app, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(tracked_dict(app))

    def delete(self, request, pk):
        JobApplication.objects.filter(user=request.user, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def _profile(self, user):
        profile, _ = CandidateProfile.objects.get_or_create(user=user, defaults={"email": user.email or ""})
        return profile

    def get(self, request):
        return Response(CandidateProfileSerializer(self._profile(request.user)).data)

    def patch(self, request):
        ser = CandidateProfileSerializer(self._profile(request.user), data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class ProfileResumeView(APIView):
    """POST: upload a resume once -> text extracted and parsed into the profile
    (fields the parser found overwrite; the rest are kept). GET downloads it."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    throttle_scope = "careers_profile_resume"

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.request.method == "POST" else []

    def post(self, request):
        upload = request.FILES.get("resume_file")
        if not upload:
            return Response({"detail": "Choose a resume file to upload."}, status=status.HTTP_400_BAD_REQUEST)
        data = upload.read()
        try:
            text = extract_text(upload.name, data)
        except ResumeParseError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        parsed, parser = parse_resume(text)

        profile, _ = CandidateProfile.objects.get_or_create(user=request.user)
        for field, value in parsed.items():
            if value not in ("", None, []):
                setattr(profile, field, value)
        if not profile.email:
            profile.email = request.user.email or ""
        if profile.resume_file:
            profile.resume_file.delete(save=False)
        upload.seek(0)
        profile.resume_file.save(upload.name, upload, save=False)
        profile.resume_filename = upload.name[:200]
        profile.resume_text = text
        profile.resume_uploaded_at = timezone.now()
        profile.resume_parsed_by = parser
        profile.save()
        return Response(CandidateProfileSerializer(profile).data)

    def get(self, request):
        profile = _profile(request.user)
        if not profile or not profile.resume_file:
            return Response({"detail": "No resume uploaded."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(profile.resume_file.open("rb"), as_attachment=True,
                            filename=profile.resume_filename or "resume")

    def delete(self, request):
        profile = _profile(request.user)
        if profile:
            if profile.resume_file:
                profile.resume_file.delete(save=False)
            profile.resume_filename = profile.resume_text = profile.resume_parsed_by = ""
            profile.resume_uploaded_at = None
            profile.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResumeCheckView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "careers_ats"

    def post(self, request, job_id):
        upload = request.FILES.get("resume_file")
        code, body, _ = run_ats_check(
            request.user, job_id,
            upload=(upload.name, upload.read()) if upload else None,
            resume_text=request.data.get("resume_text") or "",
        )
        return Response(body, status=code)


class PracticeQuestionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plan = effective_plan(request.user)
        qs = (InterviewQuestion.objects
              .filter(status=InterviewQuestion.Status.APPROVED, round__isnull=False)
              .exclude(ideal_answer="").exclude(question_type="mcq")
              .select_related("round__role__company"))
        qtype = request.query_params.get("type")
        if qtype:
            qs = qs.filter(question_type=qtype)
        q = request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(Q(question_text__icontains=q) | Q(round__role__company__name__icontains=q))
        out = []
        for item in qs.order_by("?")[:60]:
            company = item.round.role.company
            if not company.is_accessible_by(plan):
                continue
            out.append({"id": item.id, "question_text": item.question_text,
                        "question_type": item.question_type, "company": company.name,
                        "role": item.round.role.title})
            if len(out) == 20:
                break
        return Response(out)


class PracticeValidateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "careers_practice"

    def post(self, request):
        answer = (request.data.get("answer") or "").strip()
        if len(answer) > 10_000:
            return Response({"detail": "Answer is too long."}, status=status.HTTP_400_BAD_REQUEST)
        question = (InterviewQuestion.objects
                    .filter(pk=request.data.get("question_id"), status=InterviewQuestion.Status.APPROVED)
                    .exclude(ideal_answer="").select_related("round__role__company").first())
        if not question or not question.round_id or \
                not question.round.role.company.is_accessible_by(effective_plan(request.user)):
            return Response({"detail": "Question not found."}, status=status.HTTP_404_NOT_FOUND)
        result = score_answer(answer, question.ideal_answer)
        result["ideal_answer"] = question.ideal_answer
        return Response(result)
