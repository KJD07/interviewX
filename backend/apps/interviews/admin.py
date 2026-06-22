from django.contrib import admin

from .models import InterviewSession


@admin.register(InterviewSession)
class InterviewSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "round", "started_at", "ended_at")
    list_filter = ("round__role__company",)
    readonly_fields = ("transcript", "scores", "feedback", "started_at", "ended_at")
    search_fields = ("user__username", "user__email")
