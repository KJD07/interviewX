from django.contrib import admin
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import InterviewSession, RealInterviewReport

# Bonus interview credits granted to a user when their real-interview
# report is approved. Kept here (not in apps.subscriptions.plans) since
# it's a fixed reward amount, not a plan-tier limit.
REAL_REPORT_REWARD_CREDITS = 5


@admin.register(InterviewSession)
class InterviewSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "round", "started_at", "ended_at")
    list_filter = ("round__role__company",)
    readonly_fields = ("transcript", "scores", "feedback", "started_at", "ended_at")
    search_fields = ("user__username", "user__email")


@admin.register(RealInterviewReport)
class RealInterviewReportAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "status", "had_recent_interview", "company_name",
        "role_title", "can_provide_proof", "created_at", "reviewed_at",
    )
    list_filter = ("status", "had_recent_interview", "can_provide_proof")
    readonly_fields = ("session", "user", "created_at", "reviewed_at")
    search_fields = ("user__username", "user__email", "company_name", "role_title", "name", "email")
    actions = ["approve_reports", "reject_reports"]

    @admin.action(description=f"Approve selected reports (grants {REAL_REPORT_REWARD_CREDITS} bonus interviews each)")
    def approve_reports(self, request, queryset):
        # Only "yes" reports carry real data worth rewarding; re-approving
        # an already-approved report must never grant credits twice, so we
        # only touch rows that aren't approved yet.
        eligible = queryset.filter(
            had_recent_interview=RealInterviewReport.HadRecentInterview.YES
        ).exclude(status=RealInterviewReport.Status.APPROVED)
        skipped = queryset.count() - eligible.count()

        approved_count = 0
        with transaction.atomic():
            for report in eligible.select_for_update():
                User = report.user.__class__
                User.objects.filter(pk=report.user_id).update(
                    bonus_interviews=F("bonus_interviews") + REAL_REPORT_REWARD_CREDITS
                )
                report.status = RealInterviewReport.Status.APPROVED
                report.reviewed_at = timezone.now()
                report.save(update_fields=["status", "reviewed_at"])
                approved_count += 1

        message = f"Approved {approved_count} report(s), granting {approved_count * REAL_REPORT_REWARD_CREDITS} bonus interviews total."
        if skipped:
            message += f" Skipped {skipped} (already approved or no recent interview reported)."
        self.message_user(request, message)

    @admin.action(description="Reject selected reports")
    def reject_reports(self, request, queryset):
        updated = queryset.exclude(status=RealInterviewReport.Status.REJECTED).update(
            status=RealInterviewReport.Status.REJECTED, reviewed_at=timezone.now()
        )
        self.message_user(request, f"Rejected {updated} report(s).")