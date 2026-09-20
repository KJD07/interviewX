from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.enterprise.models import ReferralPartner
from apps.subscriptions.models import PaymentOrder
from apps.subscriptions.plans import amount_for

User = get_user_model()


@override_settings(
    PAYU_MERCHANT_KEY="test-key",
    PAYU_MERCHANT_SALT="test-salt",
    BACKEND_URL="http://localhost:8000",
    FRONTEND_URL="http://localhost:3000",
)
class PartnerCouponOrderTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="buyer",
            email="buyer@test.com",
            password="pw12345!",
        )
        self.partner = ReferralPartner.objects.create(
            name="Campus",
            contact_email="campus@test.com",
            contact_phone="+91 90000 00000",
            code="CAMPUS10",
            candidate_discount_percent=10,
            status=ReferralPartner.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_create_order_applies_partner_discount(self):
        list_paise = amount_for("pro")
        res = self.client.post(
            "/api/subscriptions/create-order/",
            {"plan": "pro", "partner_code": "campus10"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        body = res.json()
        self.assertEqual(body["discount_percent"], 10)
        self.assertEqual(body["partner_code"], "CAMPUS10")
        expected = int(Decimal(list_paise) * Decimal("0.9"))
        self.assertEqual(body["amount"], f"{expected / 100:.2f}")

        order = PaymentOrder.objects.get(payu_txnid=body["txnid"])
        self.assertEqual(order.amount, expected)
        self.assertEqual(order.list_amount_paise, list_paise)
        self.assertEqual(order.partner_code, "CAMPUS10")

    def test_create_order_rejects_invalid_coupon(self):
        res = self.client.post(
            "/api/subscriptions/create-order/",
            {"plan": "pro", "coupon_code": "missing"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
