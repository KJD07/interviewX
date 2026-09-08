from django.contrib import admin, messages
from django.utils import timezone

from .models import (
    CommissionLedger,
    EnterpriseLead,
    EnterprisePayment,
    Organization,
    OrganizationMember,
    OrgCandidateInvite,
    ProctoringEvent,
    ReferralAttribution,
    ReferralPartner,
)
from .referrals import commission_expires_at, convert_lead_to_organization


class OrganizationMemberInline(admin.TabularInline):
    model = OrganizationMember
    extra = 1


class ReferralAttributionInline(admin.StackedInline):
    model = ReferralAttribution
    extra = 0
    max_num = 1
    fields = ("partner", "source", "attributed_at", "expires_at")
    readonly_fields = ("attributed_at", "expires_at")


class EnterprisePaymentInline(admin.TabularInline):
    model = EnterprisePayment
    extra = 0
    fields = ("amount_paise", "description", "paid_at", "recorded_by", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "name", "contact_email", "candidates_used", "candidate_quota",
        "contract_ends", "is_active", "live_camera_enabled", "referred_partner",
    )
    list_filter = ("is_active", "live_camera_enabled")
    search_fields = ("name", "contact_email")
    inlines = [OrganizationMemberInline, ReferralAttributionInline, EnterprisePaymentInline]

    @admin.display(description="Partner")
    def referred_partner(self, obj):
        attribution = getattr(obj, "referral_attribution", None)
        if attribution is None:
            return "—"
        return attribution.partner.code

    def save_formset(self, request, form, formset, change):
        if formset.model is EnterprisePayment:
            instances = formset.save(commit=False)
            for instance in instances:
                if instance.pk is None and instance.recorded_by_id is None:
                    instance.recorded_by = request.user
                instance.save()
            formset.save_m2m()
            return
        if formset.model is ReferralAttribution:
            instances = formset.save(commit=False)
            now = timezone.now()
            for instance in instances:
                if instance.pk is None:
                    instance.attributed_at = now
                    instance.expires_at = commission_expires_at(now)
                instance.save()
            formset.save_m2m()
            return
        super().save_formset(request, form, formset, change)

    def get_readonly_fields(self, request, obj=None):
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


@admin.action(description="Convert selected leads to organizations")
def convert_leads_to_organizations(modeladmin, request, queryset):
    converted = 0
    for lead in queryset.exclude(status=EnterpriseLead.Status.CONVERTED):
        convert_lead_to_organization(lead)
        converted += 1
    messages.success(request, f"Converted {converted} lead(s) to organizations.")


@admin.register(EnterpriseLead)
class EnterpriseLeadAdmin(admin.ModelAdmin):
    list_display = (
        "company_name",
        "contact_email",
        "referral_partner",
        "referral_code",
        "seats_needed",
        "status",
        "organization",
        "created_at",
    )
    list_filter = ("status", "referral_partner")
    search_fields = ("company_name", "contact_email", "referral_code", "contact_name")
    readonly_fields = ("created_at", "organization")
    actions = [convert_leads_to_organizations]


@admin.register(ReferralPartner)
class ReferralPartnerAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "contact_email", "commission_rate", "status", "user", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "code", "contact_email", "user__email")
    readonly_fields = ("created_at",)


@admin.register(ReferralAttribution)
class ReferralAttributionAdmin(admin.ModelAdmin):
    list_display = ("organization", "partner", "source", "attributed_at", "expires_at")
    list_filter = ("source", "partner")
    search_fields = ("organization__name", "partner__code")
    readonly_fields = ("attributed_at",)

    def save_model(self, request, obj, form, change):
        if not change:
            now = timezone.now()
            obj.attributed_at = now
            obj.expires_at = commission_expires_at(now)
        super().save_model(request, obj, form, change)


@admin.register(EnterprisePayment)
class EnterprisePaymentAdmin(admin.ModelAdmin):
    list_display = ("organization", "amount_paise", "description", "paid_at", "recorded_by", "created_at")
    list_filter = ("paid_at",)
    search_fields = ("organization__name", "description")
    readonly_fields = ("created_at",)

    def save_model(self, request, obj, form, change):
        if not change and obj.recorded_by_id is None:
            obj.recorded_by = request.user
        super().save_model(request, obj, form, change)


@admin.action(description="Mark selected commissions as paid")
def mark_commissions_paid(modeladmin, request, queryset):
    now = timezone.now()
    updated = queryset.filter(status=CommissionLedger.Status.PENDING).update(
        status=CommissionLedger.Status.PAID,
        paid_at=now,
    )
    messages.success(request, f"Marked {updated} commission(s) as paid.")


@admin.register(CommissionLedger)
class CommissionLedgerAdmin(admin.ModelAdmin):
    list_display = (
        "partner",
        "organization_name",
        "gross_amount_paise",
        "commission_amount_paise",
        "status",
        "created_at",
        "paid_at",
    )
    list_filter = ("status", "partner")
    search_fields = ("partner__code", "enterprise_payment__organization__name")
    readonly_fields = ("created_at",)
    actions = [mark_commissions_paid]

    @admin.display(description="Organization")
    def organization_name(self, obj):
        if obj.enterprise_payment is None:
            return "—"
        return obj.enterprise_payment.organization.name
