from django.conf import settings
from django.db import models

from apps.companies.models import Round


class InterviewSession(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        ABANDONED = "abandoned", "Abandoned"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    round = models.ForeignKey(
        Round,
        on_delete=models.CASCADE,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_PROGRESS,
    )
    # [{"role": "user"/"ai", "text": "...", "ts": "..."}]
    transcript = models.JSONField(default=list)
    # {"communication": 8, "technical": 7, "problem_solving": 9}
    scores = models.JSONField(default=dict)
    feedback = models.TextField(blank=True)
    # Paid-plan-only AI insights: topic-level breakdown + improvement areas.
    # {"topics": [{"name": "...", "score": 7, "note": "..."}],
    #  "improvement_areas": [{"area": "...", "suggestion": "..."}]}
    # Left as {} for free-plan users — we don't even ask the AI for this
    # extra detail on their sessions, to keep their interviews cheap to run.
    insights = models.JSONField(default=dict, blank=True)
    # Time limit for this session, in minutes. Randomized 45-60 at start.
    duration_minutes = models.PositiveIntegerField(default=45)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    # Set when the interview is auto-ended because the time limit was hit.
    time_expired = models.BooleanField(default=False)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self) -> str:
        return f"Session #{self.pk} — {self.user} / {self.round}"


class RealInterviewReport(models.Model):
    """
    Optional post-interview form (paid plans only) where a candidate can
    report a REAL interview they recently gave elsewhere — company, role,
    rounds, and topics asked. Skippable. Feeds the question-sourcing /
    transcript-mining pipeline with fresh, real-world interview data.
    """

    class HadRecentInterview(models.TextChoices):
        YES = "yes", "Yes"
        NO = "no", "No"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    # Optional — set when the report was submitted right after a specific
    # EvaluLabs session (for context only); null when submitted on-demand
    # from the dashboard, since the real interview it describes doesn't
    # have to relate to any particular practice session.
    session = models.ForeignKey(
        InterviewSession,
        on_delete=models.CASCADE,
        related_name="real_reports",
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="real_interview_reports",
    )
    had_recent_interview = models.CharField(
        max_length=3,
        choices=HadRecentInterview.choices,
    )
    # Everything below is blank when had_recent_interview == "no".
    name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    company_name = models.CharField(max_length=200, blank=True)
    role_title = models.CharField(max_length=200, blank=True)
    # [{"round_name": "...", "topics": "..."}, ...] — first entry required
    # when had_recent_interview == "yes", rest optional.
    rounds = models.JSONField(default=list, blank=True)
    can_provide_proof = models.BooleanField(default=False)
    # Approving a "yes" report (see admin actions) grants the submitting
    # user 5 bonus interviews, once. Reports with had_recent_interview ==
    # "no" carry no reward and stay pending/rejected only for record-keeping.
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        if self.had_recent_interview == self.HadRecentInterview.NO:
            return f"RealInterviewReport #{self.pk} — {self.user} / no recent interview"
        return f"RealInterviewReport #{self.pk} — {self.user} / {self.company_name} ({self.role_title})"