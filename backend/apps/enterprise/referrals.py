"""B2B partner referral attribution and commission helpers."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

COMMISSION_WINDOW_DAYS = 365
DEFAULT_COMMISSION_RATE = Decimal("0.20")


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


def attribute_organization(partner, organization, source):
    """Attach a referred organization to a partner for up to 12 months."""
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
    """Record a manual enterprise invoice payment and create commission if attributed."""
    from .models import CommissionLedger, EnterprisePayment

    if amount_paise <= 0:
        raise ValueError("Payment amount must be positive.")

    payment = EnterprisePayment.objects.create(
        organization=organization,
        amount_paise=amount_paise,
        description=description.strip(),
        paid_at=paid_at or timezone.now(),
        recorded_by=recorded_by,
    )
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


@transaction.atomic
def convert_lead_to_organization(lead, contract_days: int = 365):
    """Create an Organization from a lead and attach partner attribution when present."""
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

    lead.status = EnterpriseLead.Status.CONVERTED
    lead.save(update_fields=["organization", "status"])
    return org


def create_enterprise_lead(
    company_name: str,
    contact_email: str,
    *,
    contact_name: str = "",
    seats_needed: int = 50,
    referral_code: str = "",
    message: str = "",
):
    from .models import EnterpriseLead

    partner = get_active_partner(referral_code) if referral_code else None
    normalized_code = normalize_partner_code(referral_code) if referral_code else ""

    return EnterpriseLead.objects.create(
        company_name=company_name.strip(),
        contact_name=contact_name.strip(),
        contact_email=contact_email.strip().lower(),
        seats_needed=max(seats_needed, 1),
        referral_code=normalized_code,
        referral_partner=partner,
        message=message.strip(),
    )
