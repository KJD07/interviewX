from django.conf import settings
from django.db import models

from .plans import PAID_PLANS


class PaymentOrder(models.Model):
    """Tracks a Razorpay payment order lifecycle."""

    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payment_orders",
    )
    razorpay_order_id = models.CharField(max_length=100, unique=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True)
    razorpay_signature = models.CharField(max_length=255, blank=True)
    plan = models.CharField(
        max_length=20,
        default="max",
        blank=True,
        help_text="Plan this order is for: pro | premium | max. Blank for top-up orders.",
    )
    topup_pack = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Top-up pack this order is for: spark | boost | power. Blank for plan orders.",
    )
    topup_credits = models.IntegerField(
        default=0,
        help_text="Interview credits granted by this order, if it's a top-up.",
    )
    amount = models.IntegerField(help_text="Amount in paise, e.g. 19900 = ₹199")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.CREATED
    )
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} — {self.razorpay_order_id} ({self.status})"


class SponsorshipCampaign(models.Model):
    """
    A college/institution partnership: every user who signs up (or already
    exists) with an email on `email_domain` gets `granted_plan`'s feature set
    while `sponsor_covers_until` is in the future, capped at `interview_limit`
    interviews per `cycle_days`. Created and managed entirely through the
    Django admin — there is no public-facing signup flow or API for this.

    Attachment/expiry/rollover is evaluated lazily in
    `User.sync_subscription_state()`, the same on-request pattern used for
    regular paid subscriptions (no Celery/cron worker exists in this stack).
    """

    GRANTED_PLAN_CHOICES = [(key, PAID_PLANS[key]["label"]) for key in PAID_PLANS]

    name = models.CharField(max_length=200)
    email_domain = models.CharField(
        max_length=255,
        unique=True,
        help_text="e.g. thapar.edu — students with this email domain are covered.",
    )
    granted_plan = models.CharField(max_length=20, choices=GRANTED_PLAN_CHOICES)
    interview_limit = models.PositiveIntegerField(
        default=20,
        help_text="Interviews allowed per cycle, independent of granted_plan's own monthly limit.",
    )
    cycle_days = models.PositiveIntegerField(default=30)
    sponsor_covers_until = models.DateTimeField(
        help_text="Coverage ends at this moment unless extended (e.g. the college pays for another cycle)."
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        self.email_domain = self.email_domain.strip().lstrip("@").lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.email_domain})"