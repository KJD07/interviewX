import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


class Organization(models.Model):
    """A business customer running real, proctored interviews for their own
    hiring pipeline. Admin-managed only for v1 — no self-serve signup/billing
    exists anywhere in this stack yet, mirroring how SponsorshipCampaign is
    admin-only (see apps.subscriptions.models.SponsorshipCampaign).

    candidate_quota/candidates_used is a simple running total for the life of
    the contract (not a rolling monthly cycle like consumer plans) — kept
    deliberately simple for a handful of early pilot customers onboarded by
    an admin; revisit if this needs self-serve renewal later.
    """

    name = models.CharField(max_length=200)
    contact_email = models.EmailField()
    candidate_quota = models.PositiveIntegerField(
        default=50,
        help_text="Total proctored interviews this org's contract covers.",
    )
    candidates_used = models.PositiveIntegerField(default=0)
    contract_ends = models.DateTimeField(
        help_text="Org access is disabled once this passes, unless extended."
    )
    is_active = models.BooleanField(default=True)
    # Opt-in, superuser-only feature: lets this org's members watch a
    # candidate's live camera feed (WebRTC) while their proctored interview
    # is in progress, on top of the existing flagged-moment clip capture
    # (see ProctoringEvent). Off by default for every org — deliberately not
    # exposed anywhere in the org-facing API/dashboard as something an org
    # admin/recruiter can toggle themselves; only a Django superuser can flip
    # it, from the admin (see OrganizationAdmin.get_readonly_fields).
    live_camera_enabled = models.BooleanField(
        default=False,
        help_text="Superuser-only. Lets this org's members watch a candidate's live camera feed during their interview.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name

    @property
    def is_covered(self) -> bool:
        return self.is_active and self.contract_ends > timezone.now()

    @property
    def has_quota_remaining(self) -> bool:
        return self.candidates_used < self.candidate_quota


class OrganizationMember(models.Model):
    """Links a User to an Organization so they can log into the org's
    dashboard. Deliberately a separate join model (not a FK on User) so a
    user could in principle belong to more than one org, and so this stays
    fully independent of the consumer subscription_plan/sponsorship fields
    on User — an org member's own personal plan is untouched by this."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        RECRUITER = "recruiter", "Recruiter"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="members"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="org_memberships"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ADMIN)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"], name="unique_user_per_organization"
            )
        ]

    def __str__(self) -> str:
        return f"{self.user.email} @ {self.organization.name} ({self.role})"


def _generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


class OrgCandidateInvite(models.Model):
    """One candidate's link to take a specific Round as part of an org's
    hiring pipeline. round is the existing apps.companies.Round — an org's
    question bank is just Company/Role/Round/InterviewQuestion rows scoped to
    that org (see Company.organization), so no separate question model is
    needed here."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        STARTED = "started", "Started"
        COMPLETED = "completed", "Completed"
        EXPIRED = "expired", "Expired"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="invites"
    )
    round = models.ForeignKey(
        "companies.Round", on_delete=models.CASCADE, related_name="org_invites"
    )
    candidate_email = models.EmailField()
    token = models.CharField(max_length=64, unique=True, default=_generate_invite_token)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    session = models.ForeignKey(
        "interviews.InterviewSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="org_invite",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.candidate_email} → {self.round} ({self.status})"

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= timezone.now()


class ProctoringEvent(models.Model):
    """A flagged moment during a proctored InterviewSession. Only created for
    events the client-side detector considers worth flagging (hybrid design:
    face/gaze detection runs continuously in the browser, but we only ever
    receive/store a record — and optionally a short clip — for the flagged
    moments, not a full-session recording), keeping storage and biometric-
    data exposure minimal. clip is populated only for higher-severity events;
    routine ones are logged with no clip."""

    class EventType(models.TextChoices):
        NO_FACE = "no_face", "No face detected"
        MULTIPLE_FACES = "multiple_faces", "Multiple faces detected"
        GAZE_AWAY = "gaze_away", "Looking away"
        TAB_SWITCH = "tab_switch", "Tab switch / left fullscreen"
        LOW_LIGHT = "low_light", "Low light / camera obscured"
        PHONE_DETECTED = "phone_detected", "Phone or device detected on camera"
        OTHER = "other", "Other"

    session = models.ForeignKey(
        "interviews.InterviewSession", on_delete=models.CASCADE, related_name="proctoring_events"
    )
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    confidence = models.FloatField(
        default=0.0, help_text="Client-reported detection confidence, 0-1."
    )
    note = models.CharField(
        max_length=200,
        blank=True,
        help_text="Short client-supplied reason, mainly for event_type=other (e.g. 'paste', 'devtools').",
    )
    clip = models.FileField(
        upload_to="proctoring_clips/%Y/%m/",
        null=True,
        blank=True,
        help_text="Short clip captured around this event, if the event severity warranted one.",
    )
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at"]

    def __str__(self) -> str:
        return f"{self.session_id} — {self.event_type} @ {self.occurred_at:%Y-%m-%d %H:%M}"


class ReferralPartner(models.Model):
    """External B2B partner who refers enterprise customers for commission."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"

    name = models.CharField(max_length=200)
    contact_email = models.EmailField()
    code = models.CharField(
        max_length=40,
        unique=True,
        help_text="Unique referral code used in links, e.g. THAPAR20.",
    )
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=0.20,
        help_text="Commission rate as a decimal fraction, e.g. 0.20 = 20%.",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="referral_partner",
        help_text="Optional login used for the partner dashboard.",
    )
    payout_notes = models.TextField(
        blank=True,
        default="",
        help_text="Bank/UPI details and payout notes for admin use.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        from .referrals import normalize_partner_code

        self.code = normalize_partner_code(self.code)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class ReferralAttribution(models.Model):
    """Links a referred enterprise organization to a partner."""

    class Source(models.TextChoices):
        LINK = "link", "Referral link"
        MANUAL_ADMIN = "manual_admin", "Manual admin"
        CODE_AT_SIGNUP = "code_at_signup", "Code at signup"

    partner = models.ForeignKey(
        ReferralPartner,
        on_delete=models.CASCADE,
        related_name="attributions",
    )
    organization = models.OneToOneField(
        Organization,
        on_delete=models.CASCADE,
        related_name="referral_attribution",
    )
    source = models.CharField(max_length=30, choices=Source.choices)
    attributed_at = models.DateTimeField()
    expires_at = models.DateTimeField(
        help_text="Commission window ends at this moment (default: 12 months).",
    )

    class Meta:
        ordering = ["-attributed_at"]

    def __str__(self) -> str:
        return f"{self.organization.name} → {self.partner.code}"


class EnterprisePayment(models.Model):
    """Enterprise invoice payment (admin-recorded or automatic on referred signup)."""

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    amount_paise = models.PositiveIntegerField(
        help_text="Gross payment amount in paise, e.g. 1999900 = ₹19,999.",
    )
    description = models.CharField(max_length=255, blank=True, default="")
    paid_at = models.DateTimeField()
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_enterprise_payments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_at"]

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            from .referrals import create_commission_for_payment

            create_commission_for_payment(self)

    def __str__(self) -> str:
        return f"{self.organization.name} — ₹{self.amount_paise / 100:.2f}"


class CommissionLedger(models.Model):
    """Partner commission owed or paid for attributed revenue."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        PAID = "paid", "Paid"
        VOID = "void", "Void"

    partner = models.ForeignKey(
        ReferralPartner,
        on_delete=models.CASCADE,
        related_name="commissions",
    )
    enterprise_payment = models.OneToOneField(
        EnterprisePayment,
        on_delete=models.CASCADE,
        related_name="commission",
        null=True,
        blank=True,
    )
    gross_amount_paise = models.PositiveIntegerField()
    commission_rate = models.DecimalField(max_digits=5, decimal_places=4)
    commission_amount_paise = models.PositiveIntegerField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return (
            f"{self.partner.code} — ₹{self.commission_amount_paise / 100:.2f} "
            f"({self.status})"
        )


class EnterpriseLead(models.Model):
    """Inbound enterprise interest from the public signup form.

    Valid partner referral codes auto-convert the lead into an Organization
    with attribution and a pending commission. Unreferred leads stay open for
    sales follow-up / admin conversion.
    """

    class Status(models.TextChoices):
        NEW = "new", "New"
        CONTACTED = "contacted", "Contacted"
        CONVERTED = "converted", "Converted"
        CLOSED_LOST = "closed_lost", "Closed lost"

    company_name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=120, blank=True, default="")
    contact_email = models.EmailField()
    seats_needed = models.PositiveIntegerField(
        default=50,
        help_text="Estimated number of candidate interviews the org needs.",
    )
    referral_code = models.CharField(max_length=40, blank=True, default="")
    referral_partner = models.ForeignKey(
        ReferralPartner,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
    )
    message = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
    )
    organization = models.OneToOneField(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_lead",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        partner = f" via {self.referral_partner.code}" if self.referral_partner_id else ""
        return f"{self.company_name} ({self.contact_email}){partner}"
