import hashlib
import hmac
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.http import HttpResponseRedirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.payu import (
    generate_txnid,
    paise_to_amount_str,
    payment_request_hash,
    payment_response_hash,
    verify_payment_status,
)

from .models import PaymentOrder
from .plans import PAID_PLANS, TOPUP_PACKS, amount_for, topup_amount_for, topup_credits_for


_STUCK_ORDER_AGE = timedelta(minutes=5)


def _callback_url(name: str) -> str:
    base = settings.BACKEND_URL.rstrip("/")
    return f"{base}/api/subscriptions/payu/{name}/"


def _frontend_redirect(path: str, **query) -> HttpResponseRedirect:
    url = settings.FRONTEND_URL.rstrip("/") + path
    if query:
        url += "?" + urlencode(query)
    return HttpResponseRedirect(url)


def _settle_order(order_id, payment_id, payment_hash=""):
    with transaction.atomic():
        order = (
            PaymentOrder.objects.select_for_update()
            .select_related("user")
            .get(pk=order_id)
        )
        if order.status != PaymentOrder.Status.CREATED:
            return

        now = datetime.now(timezone.utc)
        order.payu_payment_id = payment_id
        order.payu_hash = payment_hash
        order.status = PaymentOrder.Status.PAID
        order.paid_at = now
        order.save(update_fields=["payu_payment_id", "payu_hash", "status", "paid_at"])

        user = order.user
        if order.topup_pack:
            type(user).objects.filter(pk=user.pk).update(
                bonus_interviews=F("bonus_interviews") + order.topup_credits
            )
        else:
            type(user).objects.filter(pk=user.pk).update(
                subscription_plan=order.plan,
                subscription_end_date=now + timedelta(days=30),
                interviews_this_month=0,
                current_cycle_start=now,
            )


def _reconcile_stuck_orders(user):
    cutoff = datetime.now(timezone.utc) - _STUCK_ORDER_AGE
    stuck = PaymentOrder.objects.filter(
        user=user, status=PaymentOrder.Status.CREATED, created_at__lte=cutoff
    )
    if not stuck.exists():
        return

    for order in stuck:
        details = verify_payment_status(order.payu_txnid)
        if not details:
            continue
        if details.get("status") == "success":
            _settle_order(order.pk, details.get("mihpayid", ""))


def _build_payu_payload(user, amount_paise: int, productinfo: str) -> dict:
    txnid = generate_txnid()
    amount = paise_to_amount_str(amount_paise)
    firstname = (user.first_name or user.username or "User")[:60]
    email = user.email
    phone = ""

    key = settings.PAYU_MERCHANT_KEY
    salt = settings.PAYU_MERCHANT_SALT
    hash_value = payment_request_hash(
        key=key,
        txnid=txnid,
        amount=amount,
        productinfo=productinfo,
        firstname=firstname,
        email=email,
        salt=salt,
    )

    return {
        "txnid": txnid,
        "amount": amount,
        "productinfo": productinfo,
        "firstname": firstname,
        "email": email,
        "phone": phone,
        "surl": _callback_url("success"),
        "furl": _callback_url("failure"),
        "key": key,
        "hash": hash_value,
        "action": settings.PAYU_PAYMENT_URL,
        "currency": "INR",
    }


class CreateOrderView(APIView):
    """
    POST /api/subscriptions/create-order/
    Body: {"plan": "pro" | "premium" | "max"}
    Creates a PayU transaction and returns hosted-checkout form fields.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan = request.data.get("plan", "")
        if plan not in PAID_PLANS:
            return Response(
                {"detail": f"Invalid plan. Choose one of: {', '.join(PAID_PLANS)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not settings.PAYU_MERCHANT_KEY or not settings.PAYU_MERCHANT_SALT:
            return Response(
                {"detail": "Payment gateway is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        _reconcile_stuck_orders(request.user)

        amount_paise = amount_for(plan)
        plan_label = PAID_PLANS[plan]["label"]
        payload = _build_payu_payload(
            request.user,
            amount_paise,
            f"EvaluLabs {plan_label} Plan — 1 Month",
        )

        PaymentOrder.objects.create(
            user=request.user,
            payu_txnid=payload["txnid"],
            amount=amount_paise,
            plan=plan,
        )

        return Response(
            {
                **payload,
                "plan": plan,
            },
            status=status.HTTP_201_CREATED,
        )


class CreateTopupOrderView(APIView):
    """
    POST /api/subscriptions/topup/create-order/
    Body: {"pack": "spark" | "boost" | "power"}
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        pack = request.data.get("pack", "")
        if pack not in TOPUP_PACKS:
            return Response(
                {"detail": f"Invalid pack. Choose one of: {', '.join(TOPUP_PACKS)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not settings.PAYU_MERCHANT_KEY or not settings.PAYU_MERCHANT_SALT:
            return Response(
                {"detail": "Payment gateway is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        _reconcile_stuck_orders(request.user)

        amount_paise = topup_amount_for(pack)
        credits = topup_credits_for(pack)
        pack_label = TOPUP_PACKS[pack]["label"]
        payload = _build_payu_payload(
            request.user,
            amount_paise,
            f"EvaluLabs {pack_label} — {credits} interviews",
        )

        PaymentOrder.objects.create(
            user=request.user,
            payu_txnid=payload["txnid"],
            amount=amount_paise,
            plan="",
            topup_pack=pack,
            topup_credits=credits,
        )

        return Response(
            {
                **payload,
                "pack": pack,
                "credits": credits,
            },
            status=status.HTTP_201_CREATED,
        )


def _verify_and_settle_callback(post_data: dict) -> PaymentOrder | None:
    txnid = post_data.get("txnid", "")
    received_hash = post_data.get("hash", "")
    payu_status = post_data.get("status", "")

    if not txnid or not received_hash:
        return None

    try:
        order = PaymentOrder.objects.get(payu_txnid=txnid)
    except PaymentOrder.DoesNotExist:
        return None

    if order.status == PaymentOrder.Status.PAID:
        return order

    expected_hash = payment_response_hash(
        salt=settings.PAYU_MERCHANT_SALT,
        status=payu_status,
        key=post_data.get("key", settings.PAYU_MERCHANT_KEY),
        txnid=txnid,
        amount=post_data.get("amount", paise_to_amount_str(order.amount)),
        productinfo=post_data.get("productinfo", ""),
        firstname=post_data.get("firstname", ""),
        email=post_data.get("email", ""),
        udf1=post_data.get("udf1", ""),
        udf2=post_data.get("udf2", ""),
        udf3=post_data.get("udf3", ""),
        udf4=post_data.get("udf4", ""),
        udf5=post_data.get("udf5", ""),
        additional_charges=post_data.get("additionalCharges", ""),
    )

    if not hmac.compare_digest(expected_hash, received_hash):
        order.status = PaymentOrder.Status.FAILED
        order.save(update_fields=["status"])
        return None

    if payu_status != "success":
        order.status = PaymentOrder.Status.FAILED
        order.save(update_fields=["status"])
        return None

    _settle_order(order.pk, post_data.get("mihpayid", ""), received_hash)
    return order


@method_decorator(csrf_exempt, name="dispatch")
class PayUSuccessCallbackView(APIView):
    """PayU surl — browser POST after a successful payment."""

    permission_classes = []
    authentication_classes = []

    def post(self, request):
        order = _verify_and_settle_callback(request.POST.dict())
        if not order:
            return _frontend_redirect("/pricing", payment="failed")

        if order.topup_pack:
            return _frontend_redirect(
                "/dashboard",
                topup="success",
                credits=str(order.topup_credits),
            )
        return _frontend_redirect("/dashboard", upgraded="1")

    def get(self, request):
        # PayU normally POSTs; accept GET for easier local debugging.
        return self.post(request)


@method_decorator(csrf_exempt, name="dispatch")
class PayUFailureCallbackView(APIView):
    """PayU furl — browser POST after a failed/cancelled payment."""

    permission_classes = []
    authentication_classes = []

    def post(self, request):
        txnid = request.POST.get("txnid", "")
        if txnid:
            PaymentOrder.objects.filter(
                payu_txnid=txnid, status=PaymentOrder.Status.CREATED
            ).update(status=PaymentOrder.Status.FAILED)
        return _frontend_redirect("/pricing", payment="failed")

    def get(self, request):
        return self.post(request)
