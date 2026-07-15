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
from .plans import PAID_PLANS, TOPUP_PACKS, amount_for, topup_amount_for, topup_credits_for


def _razorpay_client():
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


class CreateOrderView(APIView):
    """
    POST /api/subscriptions/create-order/
    Body: {"plan": "pro" | "premium" | "max"}
    Creates a Razorpay order for the chosen plan and returns order_id + key_id.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan = request.data.get("plan", "")
        if plan not in PAID_PLANS:
            return Response(
                {"detail": f"Invalid plan. Choose one of: {', '.join(PAID_PLANS)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount = amount_for(plan)
        client = _razorpay_client()

        order_data = {
            "amount": amount,
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
            amount=amount,
            plan=plan,
        )

        return Response(
            {
                "order_id": rz_order["id"],
                "amount": amount,
                "currency": "INR",
                "plan": plan,
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

        # Idempotency guard: the signature is deterministic from
        # order_id|payment_id, so without this check a client could replay
        # an already-verified order's payload indefinitely to repeatedly
        # reset interviews_this_month and push subscription_end_date
        # forward — all off a single successful payment.
        if order.status == PaymentOrder.Status.PAID:
            return Response(
                {"detail": "This order has already been processed."},
                status=status.HTTP_400_BAD_REQUEST,
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
        user.subscription_plan = order.plan
        user.subscription_end_date = now + timedelta(days=30)
        # Fresh billing cycle: reset usage and restart the 30-day cycle clock
        # so the new plan's limit applies cleanly.
        user.interviews_this_month = 0
        user.current_cycle_start = now
        user.save(
            update_fields=[
                "subscription_plan",
                "subscription_end_date",
                "interviews_this_month",
                "current_cycle_start",
            ]
        )

        plan_label = PAID_PLANS.get(order.plan, {}).get("label", order.plan.title())

        return Response(
            {
                "detail": f"Payment verified. You are now on the {plan_label} plan.",
                "subscription_plan": order.plan,
                "subscription_end_date": user.subscription_end_date.isoformat(),
            }
        )


class CreateTopupOrderView(APIView):
    """
    POST /api/subscriptions/topup/create-order/
    Body: {"pack": "spark" | "boost" | "power"}
    Creates a Razorpay order for a one-off interview credit top-up.
    Available to any authenticated user except those already on Max
    (unlimited plan — a top-up would be meaningless there).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        pack = request.data.get("pack", "")
        if pack not in TOPUP_PACKS:
            return Response(
                {"detail": f"Invalid pack. Choose one of: {', '.join(TOPUP_PACKS)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.user.subscription_plan == "max":
            return Response(
                {"detail": "Max plan already includes unlimited interviews."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount = topup_amount_for(pack)
        credits = topup_credits_for(pack)
        client = _razorpay_client()

        order_data = {
            "amount": amount,
            "currency": "INR",
            "receipt": f"ix_topup_{request.user.pk}",
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
            amount=amount,
            plan="",
            topup_pack=pack,
            topup_credits=credits,
        )

        return Response(
            {
                "order_id": rz_order["id"],
                "amount": amount,
                "currency": "INR",
                "pack": pack,
                "credits": credits,
                "key_id": settings.RAZORPAY_KEY_ID,
                "user_email": request.user.email,
                "user_name": request.user.username,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyTopupPaymentView(APIView):
    """
    POST /api/subscriptions/topup/verify-payment/
    Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    Verifies HMAC signature and credits the purchased interviews to the
    user's bonus_interviews balance. These credits roll over and don't
    reset on the monthly billing cycle.
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

        try:
            order = PaymentOrder.objects.get(
                razorpay_order_id=order_id, user=request.user, topup_pack__in=TOPUP_PACKS
            )
        except PaymentOrder.DoesNotExist:
            return Response(
                {"detail": "Top-up order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if order.status == PaymentOrder.Status.PAID:
            return Response(
                {"detail": "This order has already been processed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

        now = datetime.now(timezone.utc)
        order.razorpay_payment_id = payment_id
        order.razorpay_signature = signature
        order.status = PaymentOrder.Status.PAID
        order.paid_at = now
        order.save(
            update_fields=["razorpay_payment_id", "razorpay_signature", "status", "paid_at"]
        )

        user = request.user
        user.bonus_interviews += order.topup_credits
        user.save(update_fields=["bonus_interviews"])

        pack_label = TOPUP_PACKS.get(order.topup_pack, {}).get("label", order.topup_pack.title())

        return Response(
            {
                "detail": f"Payment verified. {order.topup_credits} interviews added from the {pack_label}.",
                "credits_added": order.topup_credits,
                "bonus_interviews": user.bonus_interviews,
            }
        )