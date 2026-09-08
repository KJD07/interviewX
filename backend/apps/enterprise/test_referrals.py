from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    CommissionLedger,
    Organization,
    ReferralAttribution,
    ReferralPartner,
)
from .referrals import attribute_organization, record_enterprise_payment

User = get_user_model()


class ReferralSystemTests(TestCase):
    def setUp(self):
        self.partner_user = User.objects.create_user(
            username="partner",
            email="partner@agency.test",
            password="pw12345!",
        )
        self.partner = ReferralPartner.objects.create(
            name="Placement Agency",
            contact_email="partner@agency.test",
            code="AGENCY20",
            commission_rate=Decimal("0.20"),
            user=self.partner_user,
        )
        self.org = Organization.objects.create(
            name="Referred Corp",
            contact_email="hiring@referred.test",
            candidate_quota=50,
            contract_ends=timezone.now() + timedelta(days=180),
        )
        self.client = APIClient()

    def test_capture_endpoint_accepts_active_partner_code(self):
        res = self.client.post(
            "/api/enterprise/referrals/capture/",
            {"code": "agency20"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["code"], "AGENCY20")

    def test_capture_endpoint_rejects_invalid_code(self):
        res = self.client.post(
            "/api/enterprise/referrals/capture/",
            {"code": "missing"},
            format="json",
        )
        self.assertEqual(res.status_code, 404)

    def test_commission_created_for_attributed_payment(self):
        attribute_organization(
            self.partner,
            self.org,
            ReferralAttribution.Source.MANUAL_ADMIN,
        )
        payment = record_enterprise_payment(
            self.org,
            amount_paise=100000,
            description="Annual contract",
        )
        commission = CommissionLedger.objects.get(enterprise_payment=payment)
        self.assertEqual(commission.commission_amount_paise, 20000)
        self.assertEqual(commission.status, CommissionLedger.Status.PENDING)

    def test_no_commission_without_attribution(self):
        payment = record_enterprise_payment(self.org, amount_paise=100000)
        self.assertFalse(CommissionLedger.objects.filter(enterprise_payment=payment).exists())

    def test_partner_dashboard_requires_linked_user(self):
        outsider = User.objects.create_user(
            username="outsider",
            email="outsider@test.com",
            password="pw12345!",
        )
        client = APIClient()
        client.force_authenticate(outsider)
        res = client.get("/api/enterprise/partner/dashboard/")
        self.assertEqual(res.status_code, 404)

    def test_partner_dashboard_returns_summary(self):
        attribute_organization(
            self.partner,
            self.org,
            ReferralAttribution.Source.LINK,
        )
        record_enterprise_payment(self.org, amount_paise=500000)

        client = APIClient()
        client.force_authenticate(self.partner_user)
        res = client.get("/api/enterprise/partner/dashboard/")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["partner"]["code"], "AGENCY20")
        self.assertEqual(body["summary"]["referred_organizations"], 1)
        self.assertEqual(body["summary"]["earned_paise"], 100000)
        self.assertEqual(body["summary"]["pending_paise"], 100000)
