from django.contrib import admin

from .models import Organization, OrganizationMember, OrgCandidateInvite, ProctoringEvent


class OrganizationMemberInline(admin.TabularInline):
    model = OrganizationMember
    extra = 1


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "name", "contact_email", "candidates_used", "candidate_quota",
        "contract_ends", "is_active", "live_camera_enabled",
    )
    list_filter = ("is_active", "live_camera_enabled")
    search_fields = ("name", "contact_email")
    inlines = [OrganizationMemberInline]

    def get_readonly_fields(self, request, obj=None):
        # live_camera_enabled is deliberately not exposed to org admins/
        # recruiters anywhere in the app — only a Django superuser can flip
        # it, and only through this admin. A staff (non-superuser) user still
        # sees the field (it's informative) but can't edit it.
        readonly = list(super().get_readonly_fields(request, obj))
        if not request.user.is_superuser:
            readonly.append("live_camera_enabled")
        return readonly


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
    list_display = ("session", "event_type", "note", "confidence", "occurred_at", "clip")
    list_filter = ("event_type",)
    search_fields = ("session__id", "note")
