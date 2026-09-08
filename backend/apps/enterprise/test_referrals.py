from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    CommissionLedger,
    EnterpriseLead,
    Organization,
    OrganizationMember,
    ReferralAttribution,
    ReferralPartner,
)
from .referrals import (
    COMMISSION_PAYOUT_DAYS,
    ENTERPRISE_SEAT_PRICE_PAISE,
    attribute_organization,
    create_enterprise_lead,
    record_enterprise_payment,
    register_partner,
    sync_partner_commission_payouts,
)

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
        self.assertEqual(body["partner"]["payout_days"], COMMISSION_PAYOUT_DAYS)

    def test_partner_self_registration(self):
        user = User.objects.create_user(
            username="newpartner",
            email="new@partner.test",
            password="pw12345!",
        )
        client = APIClient()
        client.force_authenticate(user)
        res = client.post(
            "/api/enterprise/partner/register/",
            {
                "name": "Campus Connect",
                "preferred_code": "campus",
                "payout_notes": "UPI: campus@upi",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        body = res.json()
        self.assertTrue(body["created"])
        self.assertEqual(body["partner"]["code"], "CAMPUS")
        partner = ReferralPartner.objects.get(user=user)
        self.assertEqual(partner.name, "Campus Connect")
        self.assertEqual(partner.payout_notes, "UPI: campus@upi")

        # Idempotent re-register returns existing partner.
        res2 = client.post(
            "/api/enterprise/partner/register/",
            {"name": "Campus Connect"},
            format="json",
        )
        self.assertEqual(res2.status_code, 200)
        self.assertFalse(res2.json()["created"])
        self.assertEqual(ReferralPartner.objects.filter(user=user).count(), 1)

    def test_me_includes_is_partner(self):
        client = APIClient()
        client.force_authenticate(self.partner_user)
        res = client.get("/api/auth/me/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["is_partner"])

    def test_enterprise_lead_api_links_partner(self):
        res = self.client.post(
            "/api/enterprise/leads/",
            {
                "company_name": "Startup Inc",
                "contact_email": "founder@startup.test",
                "contact_name": "Alex",
                "seats_needed": 25,
                "referral_code": "agency20",
                "message": "Referred by our hiring partner",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        body = res.json()
        self.assertTrue(body["converted"])
        self.assertIsNotNone(body["organization_id"])

        lead = EnterpriseLead.objects.get(pk=body["id"])
        self.assertEqual(lead.referral_partner_id, self.partner.pk)
        self.assertEqual(lead.referral_code, "AGENCY20")
        self.assertEqual(lead.status, EnterpriseLead.Status.CONVERTED)
        self.assertTrue(
            ReferralAttribution.objects.filter(
                organization_id=lead.organization_id, partner=self.partner
            ).exists()
        )
        commission = CommissionLedger.objects.get(partner=self.partner)
        self.assertEqual(
            commission.gross_amount_paise,
            25 * ENTERPRISE_SEAT_PRICE_PAISE,
        )
        self.assertEqual(commission.status, CommissionLedger.Status.PENDING)

    def test_unreferred_lead_stays_open(self):
        res = self.client.post(
            "/api/enterprise/leads/",
            {
                "company_name": "Solo Corp",
                "contact_email": "hr@solo.test",
                "seats_needed": 10,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        body = res.json()
        self.assertFalse(body["converted"])
        lead = EnterpriseLead.objects.get(pk=body["id"])
        self.assertEqual(lead.status, EnterpriseLead.Status.NEW)
        self.assertIsNone(lead.organization_id)

    def test_convert_lead_creates_org_and_attribution(self):
        from .referrals import convert_lead_to_organization

        lead = create_enterprise_lead(
            "Wellfound Startup",
            "ceo@wellfound-startup.test",
            seats_needed=40,
            referral_code="AGENCY20",
            auto_convert_referred=False,
        )
        org = convert_lead_to_organization(lead)
        self.assertEqual(org.name, "Wellfound Startup")
        self.assertEqual(org.candidate_quota, 40)
        self.assertTrue(
            ReferralAttribution.objects.filter(
                organization=org, partner=self.partner
            ).exists()
        )
        lead.refresh_from_db()
        self.assertEqual(lead.status, EnterpriseLead.Status.CONVERTED)
        self.assertEqual(lead.organization_id, org.pk)

    def test_auto_convert_attaches_existing_user_as_org_admin(self):
        founder = User.objects.create_user(
            username="founder",
            email="founder@auto-org.test",
            password="pw12345!",
        )
        lead = create_enterprise_lead(
            "Auto Org",
            "founder@auto-org.test",
            seats_needed=5,
            referral_code="AGENCY20",
        )
        self.assertEqual(lead.status, EnterpriseLead.Status.CONVERTED)
        self.assertTrue(
            OrganizationMember.objects.filter(
                organization=lead.organization,
                user=founder,
                role=OrganizationMember.Role.ADMIN,
            ).exists()
        )

    def test_commission_auto_pays_after_seven_days(self):
        attribute_organization(
            self.partner,
            self.org,
            ReferralAttribution.Source.LINK,
        )
        payment = record_enterprise_payment(self.org, amount_paise=100000)
        commission = CommissionLedger.objects.get(enterprise_payment=payment)
        CommissionLedger.objects.filter(pk=commission.pk).update(
            created_at=timezone.now() - timedelta(days=COMMISSION_PAYOUT_DAYS + 1)
        )

        updated = sync_partner_commission_payouts(self.partner)
        self.assertEqual(updated, 1)
        commission.refresh_from_db()
        self.assertEqual(commission.status, CommissionLedger.Status.PAID)
        self.assertIsNotNone(commission.paid_at)

        client = APIClient()
        client.force_authenticate(self.partner_user)
        res = client.get("/api/enterprise/partner/dashboard/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["summary"]["paid_paise"], 20000)
        self.assertEqual(res.json()["summary"]["pending_paise"], 0)

    def test_register_partner_helper_generates_unique_codes(self):
        user_a = User.objects.create_user(
            username="pa", email="a@p.test", password="pw12345!"
        )
        user_b = User.objects.create_user(
            username="pb", email="b@p.test", password="pw12345!"
        )
        partner_a, _ = register_partner(user_a, name="Twin Agency", preferred_code="TWIN")
        partner_b, _ = register_partner(user_b, name="Twin Agency", preferred_code="TWIN")
        self.assertEqual(partner_a.code, "TWIN")
        self.assertNotEqual(partner_b.code, partner_a.code)
        self.assertTrue(partner_b.code.startswith("TWIN"))
