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