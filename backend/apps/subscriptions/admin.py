# Admin registrations for subscriptions (Phase 7).
from django.contrib import admin
from .models import PaymentOrder


@admin.register(PaymentOrder)
class PaymentOrderAdmin(admin.ModelAdmin):
    list_display = ["user", "razorpay_order_id", "plan", "amount", "status", "created_at", "paid_at"]
    list_filter = ["status", "plan"]
    search_fields = ["user__email", "razorpay_order_id", "razorpay_payment_id"]
    readonly_fields = ["created_at", "paid_at"]