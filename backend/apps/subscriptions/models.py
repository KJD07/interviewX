from django.conf import settings
from django.db import models


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
        help_text="Plan this order is for: pro | premium | max",
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