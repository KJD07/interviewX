from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.models import Company
from apps.subscriptions.models import PaymentOrder

from .models import ReferralVisit

User = get_user_model()
SOURCES = ("linkedin", "reddit", "instagram", "chatgpt", "direct", "other")


class ReferralVisitView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        source = str(request.data.get("source", "other")).lower().strip()
        if source not in SOURCES:
            source = "other"
        ReferralVisit.objects.create(source=source)
        return Response(status=204)


class AdminInsightsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()
        start = now - timedelta(days=365)
        paid = PaymentOrder.objects.filter(status=PaymentOrder.Status.PAID, paid_at__isnull=False)
        revenue = {
            "day": paid.filter(paid_at__gte=now - timedelta(days=1)).aggregate(total=Sum("amount"))["total"] or 0,
            "week": paid.filter(paid_at__gte=now - timedelta(days=7)).aggregate(total=Sum("amount"))["total"] or 0,
            "month": paid.filter(paid_at__gte=now - timedelta(days=30)).aggregate(total=Sum("amount"))["total"] or 0,
            "quarter": paid.filter(paid_at__gte=now - timedelta(days=90)).aggregate(total=Sum("amount"))["total"] or 0,
            "year": paid.filter(paid_at__gte=now - timedelta(days=365)).aggregate(total=Sum("amount"))["total"] or 0,
        }
        monthly_users = list(
            User.objects.filter(date_joined__gte=start).annotate(month=TruncMonth("date_joined"))
            .values("month").annotate(count=Count("id")).order_by("month")
        )
        monthly_active = list(
            User.objects.filter(last_login__gte=start).annotate(month=TruncMonth("last_login"))
            .values("month").annotate(count=Count("id")).order_by("month")
        )
        referral_counts = {source: 0 for source in SOURCES}
        for item in ReferralVisit.objects.values("source").annotate(count=Count("id")):
            referral_counts[item["source"]] = item["count"]
        daily_revenue = list(
            paid.filter(paid_at__gte=start).annotate(day=TruncDate("paid_at"))
            .values("day").annotate(total=Sum("amount")).order_by("day")
        )
        return Response({
            "referrals": referral_counts,
            "new_users": [{"month": item["month"].strftime("%b %Y"), "count": item["count"]} for item in monthly_users],
            "monthly_active_users": [{"month": item["month"].strftime("%b %Y"), "count": item["count"]} for item in monthly_active],
            "plans": {item["subscription_plan"]: item["count"] for item in User.objects.values("subscription_plan").annotate(count=Count("id"))},
            "companies": Company.objects.filter(kind=Company.Kind.COMPANY).count(),
            "revenue": revenue,
            "revenue_daily": [{"day": item["day"].isoformat(), "amount": item["total"]} for item in daily_revenue],
        })