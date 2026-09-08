from django.db.models import Sum
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CommissionLedger, ReferralAttribution, ReferralPartner
from .referrals import get_active_partner, normalize_partner_code


class PartnerReferralCaptureView(APIView):
    """POST /api/enterprise/referrals/capture/ — validate and acknowledge a partner code."""

    permission_classes = [AllowAny]

    def post(self, request):
        code = normalize_partner_code(str(request.data.get("code", "")))
        if not code or get_active_partner(code) is None:
            return Response({"detail": "Invalid or inactive referral code."}, status=404)
        return Response({"code": code}, status=200)


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

        return Response(
            {
                "partner": {
                    "name": partner.name,
                    "code": partner.code,
                    "commission_rate": str(partner.commission_rate),
                },
                "summary": {
                    "referred_organizations": attributions.count(),
                    "earned_paise": earned_paise,
                    "pending_paise": pending_paise,
                    "paid_paise": paid_paise,
                },
                "referred_organizations": referred_orgs,
                "recent_commissions": recent_commissions,
            }
        )
