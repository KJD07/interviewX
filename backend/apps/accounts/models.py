import random
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """
    Custom user model (spec Section 4).
    Must be set as AUTH_USER_MODEL before the first migration.
    """

    subscription_plan = models.CharField(
        max_length=20,
        default="free",
        help_text="free | pro | premium | max",
    )
    interviews_this_month = models.IntegerField(default=0)
    subscription_end_date = models.DateTimeField(null=True, blank=True)
    bonus_interviews = models.IntegerField(
        default=0,
        help_text=(
            "Extra interview credits bought mid-cycle via top-up packs. "
            "Consumed before counting against the monthly plan limit, and "
            "do NOT reset on billing renewal — unused credits roll over."
        ),
    )
    current_cycle_start = models.DateTimeField(
        default=timezone.now,
        help_text="Start of the current 30-day usage cycle.",
    )

    def sync_subscription_state(self):
        """Lazily downgrade lapsed subscriptions and roll the monthly
        interview counter over every 30 days. Called on request since there
        is no Celery/cron worker in this project. Returns changed fields."""
        changed = []
        now = timezone.now()

        if (
            self.subscription_plan != "free"
            and self.subscription_end_date is not None
            and self.subscription_end_date <= now
        ):
            self.subscription_plan = "free"
            self.subscription_end_date = None
            changed += ["subscription_plan", "subscription_end_date"]

        if now >= self.current_cycle_start + timedelta(days=30):
            self.interviews_this_month = 0
            elapsed_cycles = max((now - self.current_cycle_start).days // 30, 1)
            self.current_cycle_start = self.current_cycle_start + timedelta(
                days=30 * elapsed_cycles
            )
            changed += ["interviews_this_month", "current_cycle_start"]

        return changed

    # --- Email verification / auth provider tracking ---
    is_email_verified = models.BooleanField(default=False)
    auth_provider = models.CharField(
        max_length=20,
        default="email",
        help_text="email | google",
    )
    google_sub = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        unique=True,
        help_text="Google's stable account id ('sub' claim), set for Google sign-ins.",
    )

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self) -> str:
        return self.email or self.username


class EmailOTP(models.Model):
    """One-time code used to verify a user's email address before they can log in."""

    OTP_LENGTH = 6
    OTP_VALIDITY_MINUTES = 10
    MAX_ATTEMPTS = 5

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="email_otps"
    )
    code = models.CharField(max_length=OTP_LENGTH)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"OTP for {self.user.email} ({'used' if self.is_used else 'active'})"

    @classmethod
    def generate_for_user(cls, user: "User") -> "EmailOTP":
        cls.objects.filter(user=user, is_used=False).update(is_used=True)
        code = "".join(random.choices("0123456789", k=cls.OTP_LENGTH))
        return cls.objects.create(user=user, code=code)

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.created_at + timedelta(
            minutes=self.OTP_VALIDITY_MINUTES
        )

    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired and self.attempts < self.MAX_ATTEMPTS
