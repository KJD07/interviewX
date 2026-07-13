from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Review(models.Model):
    """
    A star rating + optional comment, left by a paid-plan user after an
    interview session. Prompted inline on the results page (see
    frontend ReviewCard component).
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="review",
    )
    # Nullable: the session that was on screen when the prompt fired.
    # Purely informational now — visibility is user-level, not per-session.
    session = models.ForeignKey(
        "interviews.InterviewSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    # Snapshot of the plan at review time, since subscription_plan can
    # change later and we want to know what tier the review reflects.
    plan_at_time = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} - {self.rating}/5"
