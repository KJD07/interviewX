import hashlib
import hmac
from datetime import datetime, timezone, timedelta

import razorpay
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PaymentOrder

PLAN_AMOUNT_PAISE = 49900  # ₹499


def _razorpay_client():
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


class CreateOrderView(APIView):
    """
    POST /api/subscriptions/create-order/
    Creates a Razorpay order and returns order_id + key_id to the frontend.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        client = _razorpay_client()

        order_data = {
            "amount": PLAN_AMOUNT_PAISE,
            "currency": "INR",
            "receipt": f"ix_user_{request.user.pk}",
            "payment_capture": 1,
        }

        try:
            rz_order = client.order.create(data=order_data)
        except Exception as exc:
            return Response(
                {"detail": f"Razorpay error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        PaymentOrder.objects.create(
            user=request.user,
            razorpay_order_id=rz_order["id"],
            amount=PLAN_AMOUNT_PAISE,
        )

        return Response(
            {
                "order_id": rz_order["id"],
                "amount": PLAN_AMOUNT_PAISE,
                "currency": "INR",
                "key_id": settings.RAZORPAY_KEY_ID,
                "user_email": request.user.email,
                "user_name": request.user.username,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyPaymentView(APIView):
    """
    POST /api/subscriptions/verify-payment/
    Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    Verifies HMAC signature, upgrades user to premium for 30 days.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        order_id = request.data.get("razorpay_order_id", "")
        payment_id = request.data.get("razorpay_payment_id", "")
        signature = request.data.get("razorpay_signature", "")

        if not all([order_id, payment_id, signature]):
            return Response(
                {"detail": "order_id, payment_id, and signature are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fetch our order record
        try:
            order = PaymentOrder.objects.get(
                razorpay_order_id=order_id, user=request.user
            )
        except PaymentOrder.DoesNotExist:
            return Response(
                {"detail": "Order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify HMAC-SHA256 signature
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            f"{order_id}|{payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, signature):
            order.status = PaymentOrder.Status.FAILED
            order.save(update_fields=["status"])
            return Response(
                {"detail": "Payment verification failed. Invalid signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Upgrade user
        now = datetime.now(timezone.utc)
        order.razorpay_payment_id = payment_id
        order.razorpay_signature = signature
        order.status = PaymentOrder.Status.PAID
        order.paid_at = now
        order.save(update_fields=["razorpay_payment_id", "razorpay_signature", "status", "paid_at"])

        user = request.user
        user.subscription_plan = "premium"
        user.subscription_end_date = now + timedelta(days=30)
        user.save(update_fields=["subscription_plan", "subscription_end_date"])

        return Response(
            {
                "detail": "Payment verified. You are now on the Premium plan.",
                "subscription_plan": "premium",
                "subscription_end_date": user.subscription_end_date.isoformat(),
            }
        )