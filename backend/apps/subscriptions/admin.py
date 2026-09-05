# Admin registrations for subscriptions (Phase 7).
from datetime import timedelta

from django import forms
from django.contrib import admin, messages
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import path
from django.utils import timezone

from core.spreadsheet import SpreadsheetError

from .imports import REQUIRED_COLUMNS, import_sponsorship_emails
from .models import PaymentOrder, SponsorshipCampaign, SponsorshipMember


class UploadMemberEmailsForm(forms.Form):
    file = forms.FileField(
        label="Covered emails spreadsheet (.xlsx or .csv)",
        help_text=(
            "Expected header: " + ", ".join(REQUIRED_COLUMNS) + ". "
            "Blank or malformed emails are skipped; re-uploading the same file is safe."
        ),
    )


@admin.register(PaymentOrder)
class PaymentOrderAdmin(admin.ModelAdmin):
    list_display = ["user", "payu_txnid", "plan", "amount", "status", "created_at", "paid_at"]
    list_filter = ["status", "plan"]
    search_fields = ["user__email", "payu_txnid", "payu_payment_id"]
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
        "member_count",
        "student_count",
    ]
    list_filter = ["is_active", "granted_plan"]
    search_fields = ["name", "email_domain", "members__email"]
    readonly_fields = ["created_at"]
    actions = ["extend_coverage_one_cycle"]
    change_form_template = "admin/subscriptions/sponsorshipcampaign/change_form.html"
    # Members are deliberately not an inline: an uploaded list can run to
    # thousands of rows and admin inlines don't paginate. They're reviewed and
    # edited through SponsorshipMemberAdmin's own (filterable, searchable)
    # changelist instead, linked from the campaign page.

    @admin.display(description="Emails uploaded")
    def member_count(self, obj):
        return obj.members.count()

    @admin.display(description="Users attached")
    def student_count(self, obj):
        return obj.students.count()

    def get_urls(self):
        # Prepended so this doesn't get shadowed by ModelAdmin's own
        # catch-all "<path:object_id>/change/" pattern.
        custom_urls = [
            path(
                "<path:object_id>/upload-emails/",
                self.admin_site.admin_view(self.upload_emails_view),
                name="subscriptions_sponsorshipcampaign_upload_emails",
            ),
        ]
        return custom_urls + super().get_urls()

    def upload_emails_view(self, request, object_id):
        campaign = get_object_or_404(SponsorshipCampaign, pk=object_id)

        if request.method == "POST":
            form = UploadMemberEmailsForm(request.POST, request.FILES)
            if form.is_valid():
                try:
                    result = import_sponsorship_emails(campaign, form.cleaned_data["file"])
                except SpreadsheetError as exc:
                    self.message_user(request, str(exc), level=messages.ERROR)
                else:
                    self.message_user(
                        request,
                        f"Added {result.members_created} email(s) to “{campaign.name}” "
                        f"out of {result.rows_seen} row(s) seen. "
                        f"Skipped {result.rows_skipped} unusable row(s) and "
                        f"{result.members_skipped_duplicate} already-covered email(s).",
                        level=messages.SUCCESS,
                    )
                    if result.skipped_examples:
                        self.message_user(
                            request,
                            "Examples of skipped rows: " + "; ".join(result.skipped_examples),
                            level=messages.WARNING,
                        )
                return redirect(
                    "admin:subscriptions_sponsorshipcampaign_change", campaign.pk
                )
        else:
            form = UploadMemberEmailsForm()

        context = {
            **self.admin_site.each_context(request),
            "form": form,
            "opts": self.model._meta,
            "campaign": campaign,
            "title": f"Upload covered emails — {campaign.name}",
        }
        return render(request, "admin/subscriptions/upload_emails.html", context)


@admin.register(SponsorshipMember)
class SponsorshipMemberAdmin(admin.ModelAdmin):
    list_display = ["email", "campaign", "created_at"]
    list_filter = ["campaign"]
    search_fields = ["email", "campaign__name"]
    readonly_fields = ["created_at"]

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