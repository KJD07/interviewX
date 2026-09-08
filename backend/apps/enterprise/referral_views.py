from django.db.models import Sum
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CommissionLedger, EnterpriseLead, ReferralAttribution, ReferralPartner
from .referrals import (
    COMMISSION_PAYOUT_DAYS,
    get_active_partner,
    normalize_partner_code,
    register_partner,
    sync_partner_commission_payouts,
)
from .serializers import EnterpriseLeadCreateSerializer, PartnerRegisterSerializer


def _partner_dashboard_payload(partner):
    sync_partner_commission_payouts(partner)

    commissions = CommissionLedger.objects.filter(partner=partner)
    earned_paise = commissions.aggregate(total=Sum("commission_amount_paise"))["total"] or 0
    pending_paise = (
        commissions.filter(status=CommissionLedger.Status.PENDING).aggregate(
            total=Sum("commission_amount_paise")
        )["total"]
        or 0
    )
    paid_paise = (
        commissions.filter(status=CommissionLedger.Status.PAID).aggregate(
            total=Sum("commission_amount_paise")
        )["total"]
        or 0
    )

    attributions = (
        ReferralAttribution.objects.filter(partner=partner)
        .select_related("organization")
        .order_by("-attributed_at")
    )
    referred_orgs = [
        {
            "organization_id": row.organization_id,
            "organization_name": row.organization.name,
            "attributed_at": row.attributed_at.isoformat(),
            "expires_at": row.expires_at.isoformat(),
            "source": row.source,
        }
        for row in attributions
    ]

    recent_commissions = [
        {
            "id": row.id,
            "organization_name": row.enterprise_payment.organization.name
            if row.enterprise_payment
            else None,
            "gross_amount_paise": row.gross_amount_paise,
            "commission_amount_paise": row.commission_amount_paise,
            "commission_rate": str(row.commission_rate),
            "status": row.status,
            "created_at": row.created_at.isoformat(),
            "paid_at": row.paid_at.isoformat() if row.paid_at else None,
        }
        for row in commissions.select_related(
            "enterprise_payment__organization"
        ).order_by("-created_at")[:20]
    ]

    open_leads_qs = EnterpriseLead.objects.filter(referral_partner=partner).exclude(
        status=EnterpriseLead.Status.CONVERTED
    )
    open_leads = open_leads_qs.order_by("-created_at")[:20]
    recent_leads = [
        {
            "id": row.id,
            "company_name": row.company_name,
            "contact_email": row.contact_email,
            "seats_needed": row.seats_needed,
            "status": row.status,
            "created_at": row.created_at.isoformat(),
        }
        for row in open_leads
    ]

    return {
        "partner": {
            "name": partner.name,
            "code": partner.code,
            "commission_rate": str(partner.commission_rate),
            "payout_days": COMMISSION_PAYOUT_DAYS,
        },
        "summary": {
            "referred_organizations": attributions.count(),
            "open_leads": open_leads_qs.count(),
            "earned_paise": earned_paise,
            "pending_paise": pending_paise,
            "paid_paise": paid_paise,
        },
        "referred_organizations": referred_orgs,
        "recent_leads": recent_leads,
        "recent_commissions": recent_commissions,
    }


class PartnerReferralCaptureView(APIView):
    """POST /api/enterprise/referrals/capture/ — validate and acknowledge a partner code."""

    permission_classes = [AllowAny]

    def post(self, request):
        code = normalize_partner_code(str(request.data.get("code", "")))
        if not code or get_active_partner(code) is None:
            return Response({"detail": "Invalid or inactive referral code."}, status=404)
        return Response({"code": code}, status=200)


class EnterpriseLeadCreateView(APIView):
    """POST /api/enterprise/leads/ — public enterprise interest form.

    Valid partner referral codes auto-convert the lead into an Organization
    with attribution and a pending commission (paid out after 7 days).
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EnterpriseLeadCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lead = serializer.save()
        converted = lead.status == lead.Status.CONVERTED and lead.organization_id is not None
        detail = (
            "Thanks — your enterprise workspace is being prepared and your partner has been credited."
            if converted and lead.referral_partner_id
            else "Thanks — we'll reach out shortly to set up your workspace."
        )
        return Response(
            {
                "id": lead.id,
                "detail": detail,
                "referral_partner": lead.referral_partner.name if lead.referral_partner_id else None,
                "converted": converted,
                "organization_id": lead.organization_id,
            },
            status=status.HTTP_201_CREATED,
        )


class PartnerRegisterView(APIView):
    """POST /api/enterprise/partner/register/ — self-serve partner enrollment."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PartnerRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            partner, created = register_partner(
                request.user,
                name=data["name"],
                contact_email=data.get("contact_email") or request.user.email,
                preferred_code=data.get("preferred_code") or "",
                payout_notes=data.get("payout_notes") or "",
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "created": created,
                "partner": {
                    "name": partner.name,
                    "code": partner.code,
                    "commission_rate": str(partner.commission_rate),
                    "payout_days": COMMISSION_PAYOUT_DAYS,
                },
                "detail": (
                    "You're enrolled in the partner program."
                    if created
                    else "You're already enrolled — here's your partner dashboard."
                ),
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class PartnerDashboardView(APIView):
    """GET /api/enterprise/partner/dashboard/ — partner commission summary."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        partner = (
            ReferralPartner.objects.filter(user=request.user, status=ReferralPartner.Status.ACTIVE)
            .first()
        )
        if partner is None:
            return Response({"detail": "Not a referral partner."}, status=404)

        return Response(_partner_dashboard_payload(partner))
