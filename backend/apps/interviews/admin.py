from django.contrib import admin

from .models import InterviewSession, RealInterviewReport


@admin.register(InterviewSession)
class InterviewSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "round", "started_at", "ended_at")
    list_filter = ("round__role__company",)
    readonly_fields = ("transcript", "scores", "feedback", "started_at", "ended_at")
    search_fields = ("user__username", "user__email")


@admin.register(RealInterviewReport)
class RealInterviewReportAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "had_recent_interview", "company_name", "role_title", "can_provide_proof", "created_at")
    list_filter = ("had_recent_interview", "can_provide_proof")
    readonly_fields = ("session", "user", "created_at")
    search_fields = ("user__username", "user__email", "company_name", "role_title", "name", "email")