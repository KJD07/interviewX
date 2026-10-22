from django.conf import settings
from django.db import models


class Job(models.Model):
    """A recently posted job pulled from a free public job feed."""

    source = models.CharField(max_length=30)
    external_id = models.CharField(max_length=120)
    title = models.CharField(max_length=300)
    company = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True)
    url = models.URLField(max_length=600)
    description = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    posted_at = models.DateTimeField(db_index=True)
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-posted_at"]
        constraints = [
            models.UniqueConstraint(fields=["source", "external_id"], name="uniq_job_source_extid"),
        ]

    def __str__(self) -> str:
        return f"{self.title} @ {self.company}"


class JobFeedState(models.Model):
    """Singleton row (pk=1) tracking the last feed refresh, so the 5-hour
    refresh can be evaluated lazily on request (no cron worker exists)."""

    last_refreshed_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=300, blank=True)


class ResumeCheck(models.Model):
    """One resume-vs-job ATS check. Rows double as the daily-quota ledger."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="resume_checks")
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="resume_checks")
    ats_score = models.PositiveSmallIntegerField()
    matched_keywords = models.JSONField(default=list)
    missing_keywords = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
