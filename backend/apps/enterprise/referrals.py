"""B2B partner referral attribution and commission helpers."""

from __future__ import annotations

import re
import secrets
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

COMMISSION_WINDOW_DAYS = 365
# Pending commissions auto-mark as paid after this many days (lazy, on request).
COMMISSION_PAYOUT_DAYS = 7
DEFAULT_COMMISSION_RATE = Decimal("0.20")
# Matches the public enterprise per-seat price on the marketing/dashboard pages.
ENTERPRISE_SEAT_PRICE_PAISE = 19900


def normalize_partner_code(code: str) -> str:
    return code.strip().upper()


def commission_expires_at(attributed_at):
    return attributed_at + timedelta(days=COMMISSION_WINDOW_DAYS)


def commission_amount_paise(gross_amount_paise: int, rate: Decimal) -> int:
    gross = Decimal(gross_amount_paise)
    return int((gross * rate).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def get_active_partner(code: str):
    from .models import ReferralPartner

    normalized = normalize_partner_code(code)
    if not normalized:
        return None
    return (
        ReferralPartner.objects.filter(code=normalized, status=ReferralPartner.Status.ACTIVE)
        .first()
    )


def generate_unique_partner_code(name: str, preferred: str = "") -> str:
    """Build a short unique uppercase code from a preferred value or company name."""
    from .models import ReferralPartner

    raw = preferred or name
    slug = re.sub(r"[^A-Z0-9]", "", normalize_partner_code(raw))
    if len(slug) < 3:
        slug = (slug + "PARTNER")[:8]
    base = slug[:16]

    if not ReferralPartner.objects.filter(code=base).exists():
        return base

    for _ in range(40):
        suffix = secrets.token_hex(2).upper()
        candidate = f"{base[:12]}{suffix}"
        if not ReferralPartner.objects.filter(code=candidate).exists():
            return candidate

    # Extremely unlikely fallback.
    return f"P{secrets.token_hex(6).upper()}"


@transaction.atomic
def register_partner(
    user,
    *,
    name: str,
    contact_email: str = "",
    preferred_code: str = "",
    payout_notes: str = "",
):
    """Self-serve partner enrollment. One active partner record per user."""
    from .models import ReferralPartner

    existing = ReferralPartner.objects.filter(user=user).first()
    if existing is not None:
        if existing.status != ReferralPartner.Status.ACTIVE:
            existing.status = ReferralPartner.Status.ACTIVE
            existing.name = name.strip() or existing.name
            if contact_email.strip():
                existing.contact_email = contact_email.strip().lower()
            if payout_notes.strip():
                existing.payout_notes = payout_notes.strip()
            existing.save()
        return existing, False

    email = (contact_email or user.email or "").strip().lower()
    if not email:
        raise ValueError("A contact email is required to register as a partner.")

    partner = ReferralPartner.objects.create(
        name=name.strip(),
        contact_email=email,
        code=generate_unique_partner_code(name, preferred_code),
        commission_rate=DEFAULT_COMMISSION_RATE,
        status=ReferralPartner.Status.ACTIVE,
        user=user,
        payout_notes=payout_notes.strip(),
    )
    return partner, True


def attribute_organization(partner, organization, source):
    """Attach a referred enterprise organization to a partner for up to 12 months."""
    from .models import ReferralAttribution

    now = timezone.now()
    attribution, created = ReferralAttribution.objects.get_or_create(
        organization=organization,
        defaults={
            "partner": partner,
            "source": source,
            "attributed_at": now,
            "expires_at": commission_expires_at(now),
        },
    )
    if not created and attribution.partner_id != partner.pk:
        raise ValueError("Organization is already attributed to another partner.")
    return attribution


@transaction.atomic
def record_enterprise_payment(
    organization,
    amount_paise: int,
    description: str = "",
    paid_at=None,
    recorded_by=None,
):
    """Record an enterprise invoice payment and create commission if attributed."""
    from .models import EnterprisePayment

    if amount_paise <= 0:
        raise ValueError("Payment amount must be positive.")

    payment = EnterprisePayment.objects.create(
        organization=organization,
        amount_paise=amount_paise,
        description=description.strip(),
        paid_at=paid_at or timezone.now(),
        recorded_by=recorded_by,
    )
    # EnterprisePayment.save already creates the commission for new rows;
    # call again is a no-op thanks to the duplicate guard.
    create_commission_for_payment(payment)
    return payment


def create_commission_for_payment(payment):
    """Create a pending commission row for an attributed org payment, if eligible."""
    from .models import CommissionLedger, ReferralAttribution, ReferralPartner

    if CommissionLedger.objects.filter(enterprise_payment=payment).exists():
        return None

    attribution = (
        ReferralAttribution.objects.select_related("partner")
        .filter(organization=payment.organization)
        .first()
    )
    if attribution is None:
        return None

    partner = attribution.partner
    if partner.status != ReferralPartner.Status.ACTIVE:
        return None

    paid_at = payment.paid_at or timezone.now()
    if paid_at > attribution.expires_at:
        return None

    rate = partner.commission_rate
    commission_paise = commission_amount_paise(payment.amount_paise, rate)
    if commission_paise <= 0:
        return None

    return CommissionLedger.objects.create(
        partner=partner,
        enterprise_payment=payment,
        gross_amount_paise=payment.amount_paise,
        commission_rate=rate,
        commission_amount_paise=commission_paise,
        status=CommissionLedger.Status.PENDING,
    )


def sync_partner_commission_payouts(partner=None):
    """Lazily mark pending commissions older than COMMISSION_PAYOUT_DAYS as paid.

    No Celery/cron exists in this stack — call this on partner dashboard reads
    (and any other partner-facing request) the same way User.sync_subscription_state
    runs on authenticated requests.
    """
    from .models import CommissionLedger

    cutoff = timezone.now() - timedelta(days=COMMISSION_PAYOUT_DAYS)
    qs = CommissionLedger.objects.filter(
        status=CommissionLedger.Status.PENDING,
        created_at__lte=cutoff,
    )
    if partner is not None:
        qs = qs.filter(partner=partner)
    return qs.update(status=CommissionLedger.Status.PAID, paid_at=timezone.now())


def _maybe_attach_org_admin(organization, contact_email: str):
    """If a user already exists for the lead email, make them the org admin."""
    from django.contrib.auth import get_user_model

    from .models import OrganizationMember

    email = (contact_email or "").strip().lower()
    if not email:
        return None
    User = get_user_model()
    user = User.objects.filter(email__iexact=email).first()
    if user is None:
        return None
    membership, _ = OrganizationMember.objects.get_or_create(
        organization=organization,
        user=user,
        defaults={"role": OrganizationMember.Role.ADMIN},
    )
    return membership


@transaction.atomic
def convert_lead_to_organization(lead, contract_days: int = 365, *, create_signup_payment: bool = False):
    """Create an Organization from a lead and attach partner attribution when present.

    When create_signup_payment is True (automatic referred-lead conversion), also
    records a seat-pack payment so commission starts pending and pays out in
    COMMISSION_PAYOUT_DAYS via sync_partner_commission_payouts.
    """
    from .models import EnterpriseLead, ReferralAttribution

    if lead.organization_id:
        org = lead.organization
    else:
        now = timezone.now()
        from .models import Organization

        org = Organization.objects.create(
            name=lead.company_name,
            contact_email=lead.contact_email,
            candidate_quota=lead.seats_needed,
            contract_ends=now + timedelta(days=contract_days),
        )
        lead.organization = org

    if lead.referral_partner_id and not ReferralAttribution.objects.filter(
        organization=org
    ).exists():
        attribute_organization(
            lead.referral_partner,
            org,
            ReferralAttribution.Source.CODE_AT_SIGNUP,
        )

    _maybe_attach_org_admin(org, lead.contact_email)

    lead.status = EnterpriseLead.Status.CONVERTED
    lead.save(update_fields=["organization", "status"])

    if create_signup_payment and lead.referral_partner_id:
        from .models import EnterprisePayment

        if not EnterprisePayment.objects.filter(organization=org).exists():
            amount = max(lead.seats_needed, 1) * ENTERPRISE_SEAT_PRICE_PAISE
            record_enterprise_payment(
                org,
                amount_paise=amount,
                description=f"Automatic enterprise signup ({lead.seats_needed} seats)",
            )

    return org


def create_enterprise_lead(
    company_name: str,
    contact_email: str,
    *,
    contact_name: str = "",
    seats_needed: int = 50,
    referral_code: str = "",
    message: str = "",
    auto_convert_referred: bool = True,
):
    """Create an enterprise interest lead.

    Referred leads (valid partner code) are converted automatically so the
    partner dashboard shows the organization immediately and commission starts.
    Unreferred leads stay as open leads for sales follow-up.
    """
    from .models import EnterpriseLead

    partner = get_active_partner(referral_code) if referral_code else None
    normalized_code = normalize_partner_code(referral_code) if referral_code else ""

    lead = EnterpriseLead.objects.create(
        company_name=company_name.strip(),
        contact_name=contact_name.strip(),
        contact_email=contact_email.strip().lower(),
        seats_needed=max(seats_needed, 1),
        referral_code=normalized_code,
        referral_partner=partner,
        message=message.strip(),
    )

    if auto_convert_referred and partner is not None:
        convert_lead_to_organization(lead, create_signup_payment=True)

    return lead
