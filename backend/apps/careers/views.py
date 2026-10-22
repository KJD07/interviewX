from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.companies.models import InterviewQuestion
from apps.subscriptions.plans import effective_plan

from . import feeds
from .graphs import quota, run_ats_check
from .models import Job, JobFeedState
from .practice import score_answer

PAGE_SIZE = 20


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
        limit, used = quota(request.user)
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
