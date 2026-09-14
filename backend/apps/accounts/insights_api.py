import calendar
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.db.models.functions import ExtractMonth, ExtractYear, TruncDate
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


def _month_label(year, month):
    return f"{calendar.month_abbr[int(month)]} {int(year)}"


def _counts_by_calendar_month(queryset, field, start):
    """Group rows by calendar month in the project timezone (IST).

    TruncMonth + values() is easy to get wrong: default Meta.ordering is
    added to GROUP BY (one row per record, count=1), and UTC truncation
    plus strftime() without localtime() labels September IST signups as
    August. ExtractYear/ExtractMonth with tzinfo avoids both.
    """
    tz = timezone.get_current_timezone()
    rows = (
        queryset.order_by()
        .filter(**{f"{field}__gte": start})
        .annotate(
            year=ExtractYear(field, tzinfo=tz),
            month_num=ExtractMonth(field, tzinfo=tz),
        )
        .values("year", "month_num")
        .annotate(count=Count("id"))
        .order_by("year", "month_num")
    )
    return [
        {"month": _month_label(item["year"], item["month_num"]), "count": item["count"]}
        for item in rows
        if item["year"] and item["month_num"]
    ]


class AdminInsightsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()
        start = now - timedelta(days=365)
        tz = timezone.get_current_timezone()
        paid = PaymentOrder.objects.filter(status=PaymentOrder.Status.PAID, paid_at__isnull=False)
        revenue = {
            "day": paid.filter(paid_at__gte=now - timedelta(days=1)).aggregate(total=Sum("amount"))["total"] or 0,
            "week": paid.filter(paid_at__gte=now - timedelta(days=7)).aggregate(total=Sum("amount"))["total"] or 0,
            "month": paid.filter(paid_at__gte=now - timedelta(days=30)).aggregate(total=Sum("amount"))["total"] or 0,
            "quarter": paid.filter(paid_at__gte=now - timedelta(days=90)).aggregate(total=Sum("amount"))["total"] or 0,
            "year": paid.filter(paid_at__gte=now - timedelta(days=365)).aggregate(total=Sum("amount"))["total"] or 0,
        }
        referral_counts = {source: 0 for source in SOURCES}
        for item in ReferralVisit.objects.order_by().values("source").annotate(count=Count("id")):
            referral_counts[item["source"]] = item["count"]
        daily_revenue = list(
            paid.filter(paid_at__gte=start)
            .order_by()
            .annotate(day=TruncDate("paid_at", tzinfo=tz))
            .values("day")
            .annotate(total=Sum("amount"))
            .order_by("day")
        )
        return Response({
            "referrals": referral_counts,
            "new_users": _counts_by_calendar_month(User.objects.all(), "date_joined", start),
            "monthly_active_users": _counts_by_calendar_month(User.objects.all(), "last_login", start),
            "plans": {item["subscription_plan"]: item["count"] for item in User.objects.order_by().values("subscription_plan").annotate(count=Count("id"))},
            "companies": Company.objects.filter(kind=Company.Kind.COMPANY).count(),
            "revenue": revenue,
            "revenue_daily": [{"day": item["day"].isoformat(), "amount": item["total"]} for item in daily_revenue],
        })
