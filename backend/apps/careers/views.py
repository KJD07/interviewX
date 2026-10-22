from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.companies.models import InterviewQuestion
from apps.subscriptions.plans import ats_daily_limit, effective_plan

from . import feeds
from .ats import MAX_TEXT_CHARS, ats_check
from .resume_parser import ResumeParseError, extract_text
from .models import Job, JobFeedState, ResumeCheck
from .practice import score_answer

PAGE_SIZE = 20


def _quota(user):
    """(limit|None, used_today)"""
    today = timezone.localdate()
    used = ResumeCheck.objects.filter(user=user, created_at__date=today).count()
    return ats_daily_limit(user), used


def _job_dict(job, with_description=False):
    d = {
        "id": job.id, "title": job.title, "company": job.company, "location": job.location,
        "url": job.url, "tags": job.tags, "posted_at": job.posted_at, "source": job.source,
    }
    if with_description:
        d["description"] = job.description
    return d


class JobListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        feeds.refresh_if_stale()
        qs = Job.objects.all()
        q = request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(company__icontains=q) | Q(location__icontains=q))
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        total = qs.count()
        jobs = qs[(page - 1) * PAGE_SIZE : page * PAGE_SIZE]
        state = JobFeedState.objects.filter(pk=1).first()
        limit, used = _quota(request.user)
        return Response({
            "results": [_job_dict(j) for j in jobs],
            "count": total, "page": page, "page_size": PAGE_SIZE,
            "last_refreshed_at": state.last_refreshed_at if state else None,
            "ats_quota": {"limit": limit, "used": used},
        })


class JobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        job = Job.objects.filter(pk=job_id).first()
        if not job:
            return Response({"detail": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_job_dict(job, with_description=True))


class ResumeCheckView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "careers_ats"

    def post(self, request, job_id):
        upload = request.FILES.get("resume_file")
        if upload:
            try:
                resume = extract_text(upload.name, upload.read())
            except ResumeParseError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            resume = (request.data.get("resume_text") or "").strip()
        resume = resume[:MAX_TEXT_CHARS]
        if len(resume) < 100:
            return Response({"detail": "Upload your resume or paste its full text (at least 100 characters)."},
                            status=status.HTTP_400_BAD_REQUEST)
        job = Job.objects.filter(pk=job_id).first()
        if not job:
            return Response({"detail": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        # Serialise per user so parallel requests can't slip past the daily cap.
        from django.db import transaction
        from django.contrib.auth import get_user_model
        with transaction.atomic():
            user = get_user_model().objects.select_for_update().get(pk=request.user.pk)
            limit, used = _quota(user)
            if limit is not None and used >= limit:
                return Response(
                    {"detail": f"Daily limit of {limit} resume checks reached. Upgrade to Pro (₹199/month) for unlimited checks.",
                     "code": "ats_daily_limit", "ats_quota": {"limit": limit, "used": used}},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            result = ats_check(resume, job.title, job.description, job.tags)
            if result["ats_score"] is None:
                return Response({"detail": "This posting lists no recognisable skills to check against."},
                                status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            ResumeCheck.objects.create(
                user=user, job=job, ats_score=result["ats_score"],
                matched_keywords=result["matched_keywords"], missing_keywords=result["missing_keywords"],
            )
        result["ats_quota"] = {"limit": limit, "used": used + 1}
        return Response(result)


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
