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
