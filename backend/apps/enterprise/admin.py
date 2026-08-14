from django.contrib import admin

from .models import Organization, OrganizationMember, OrgCandidateInvite, ProctoringEvent


class OrganizationMemberInline(admin.TabularInline):
    model = OrganizationMember
    extra = 1


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_email", "candidates_used", "candidate_quota", "contract_ends", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "contact_email")
    inlines = [OrganizationMemberInline]


@admin.register(OrganizationMember)
class OrganizationMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role", "created_at")
    list_filter = ("organization", "role")
    search_fields = ("user__email", "organization__name")


@admin.register(OrgCandidateInvite)
class OrgCandidateInviteAdmin(admin.ModelAdmin):
    list_display = ("candidate_email", "organization", "round", "status", "expires_at", "created_at")
    list_filter = ("status", "organization")
    search_fields = ("candidate_email", "token")
    readonly_fields = ("token",)


@admin.register(ProctoringEvent)
class ProctoringEventAdmin(admin.ModelAdmin):
    list_display = ("session", "event_type", "confidence", "occurred_at", "clip")
    list_filter = ("event_type",)
    search_fields = ("session__id",)
