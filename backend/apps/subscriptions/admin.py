# Admin registrations for subscriptions (Phase 7).
from datetime import timedelta

from django.contrib import admin
from django.utils import timezone

from .models import PaymentOrder, SponsorshipCampaign


@admin.register(PaymentOrder)
class PaymentOrderAdmin(admin.ModelAdmin):
    list_display = ["user", "razorpay_order_id", "plan", "amount", "status", "created_at", "paid_at"]
    list_filter = ["status", "plan"]
    search_fields = ["user__email", "razorpay_order_id", "razorpay_payment_id"]
    readonly_fields = ["created_at", "paid_at"]


@admin.register(SponsorshipCampaign)
class SponsorshipCampaignAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "email_domain",
        "granted_plan",
        "interview_limit",
        "cycle_days",
        "sponsor_covers_until",
        "is_active",
        "student_count",
    ]
    list_filter = ["is_active", "granted_plan"]
    search_fields = ["name", "email_domain"]
    readonly_fields = ["created_at"]
    actions = ["extend_coverage_one_cycle"]

    def student_count(self, obj):
        return obj.students.count()

    @admin.action(description="Extend coverage by one cycle (record an offline/institution payment)")
    def extend_coverage_one_cycle(self, request, queryset):
        now = timezone.now()
        count = 0
        for campaign in queryset:
            base = max(campaign.sponsor_covers_until, now)
            campaign.sponsor_covers_until = base + timedelta(days=campaign.cycle_days)
            campaign.save(update_fields=["sponsor_covers_until"])
            count += 1
        self.message_user(request, f"Extended coverage for {count} campaign(s).")