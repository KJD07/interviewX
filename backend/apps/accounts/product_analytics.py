"""Aggregated product analytics for /analytics — DB-first, PostHog enrichment optional."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.enterprise.models import OrgCandidateInvite
from apps.interviews.models import InterviewSession
from apps.subscriptions.models import PaymentOrder

from core.posthog_client import hogql_query

from .models import ReferralVisit

User = get_user_model()

PERIODS = {
    "day": 1,
    "week": 7,
    "month": 30,
    "quarter": 90,
}
SOURCES = ("linkedin", "reddit", "instagram", "chatgpt", "direct", "other")
FEATURE_EVENTS = (
    "interview_started",
    "interview_completed",
    "subscription_purchased",
    "pricing_viewed",
    "progress_viewed",
    "enterprise_dashboard_viewed",
    "enterprise_invite_sent",
)


def _period_bounds(period: str):
    days = PERIODS.get(period, 7)
    now = timezone.now()
    start = now - timedelta(days=days)
    prev_start = now - timedelta(days=days * 2)
    return now, start, prev_start, days


def _enterprise_session_filter():
    return Q(org_invite__isnull=False)


def _practice_session_filter():
    return Q(org_invite__isnull=True)


def _product_session_qs(product: str):
    qs = InterviewSession.objects.all()
    if product == "enterprise":
        return qs.filter(_enterprise_session_filter())
    if product == "practice":
        return qs.filter(_practice_session_filter())
    return qs


def _db_feature_usage(start, product: str) -> dict[str, int]:
    usage = {name: 0 for name in FEATURE_EVENTS}
    session_qs = _product_session_qs(product).filter(started_at__gte=start)
    usage["interview_started"] = session_qs.count()
    usage["interview_completed"] = session_qs.filter(
        status=InterviewSession.Status.COMPLETED
    ).count()
    if product in ("all", "enterprise"):
        usage["enterprise_invite_sent"] = OrgCandidateInvite.objects.filter(
            created_at__gte=start
        ).count()
    paid = PaymentOrder.objects.filter(
        status=PaymentOrder.Status.PAID,
        paid_at__isnull=False,
        paid_at__gte=start,
    )
    usage["subscription_purchased"] = paid.count()
    return usage


def _posthog_feature_usage(start, product: str) -> dict[str, int] | None:
    product_clause = ""
    if product == "practice":
        product_clause = "AND properties.product_area = 'practice'"
    elif product == "enterprise":
        product_clause = "AND properties.product_area = 'enterprise'"

    event_list = ", ".join(f"'{e}'" for e in FEATURE_EVENTS)
    sql = f"""
        SELECT event, count() AS cnt
        FROM events
        WHERE timestamp >= toDateTime('{start.strftime("%Y-%m-%d %H:%M:%S")}')
          AND event IN ({event_list})
          {product_clause}
        GROUP BY event
    """
    rows = hogql_query(sql)
    if rows is None:
        return None
    counts = {name: 0 for name in FEATURE_EVENTS}
    for row in rows:
        event = row.get("event")
        if event in counts:
            counts[event] = int(row.get("cnt") or 0)
    return counts


def _posthog_active_users(start) -> int | None:
    sql = f"""
        SELECT count(DISTINCT person_id) AS active
        FROM events
        WHERE timestamp >= toDateTime('{start.strftime("%Y-%m-%d %H:%M:%S")}')
    """
    rows = hogql_query(sql)
    if not rows:
        return None
    return int(rows[0].get("active") or 0)


def _posthog_new_users(start) -> int | None:
    sql = f"""
        SELECT count() AS new_users
        FROM persons
        WHERE created_at >= toDateTime('{start.strftime("%Y-%m-%d %H:%M:%S")}')
    """
    rows = hogql_query(sql)
    if not rows:
        return None
    return int(rows[0].get("new_users") or 0)


def _posthog_acquisition(start) -> dict[str, int] | None:
    sql = f"""
        SELECT
            coalesce(properties.$initial_utm_source, properties.initial_referral_source, 'direct') AS source,
            count() AS cnt
        FROM persons
        WHERE created_at >= toDateTime('{start.strftime("%Y-%m-%d %H:%M:%S")}')
        GROUP BY source
    """
    rows = hogql_query(sql)
    if rows is None:
        return None
    counts = {source: 0 for source in SOURCES}
    for row in rows:
        raw = str(row.get("source") or "direct").lower()
        key = raw if raw in counts else "other"
        counts[key] = counts.get(key, 0) + int(row.get("cnt") or 0)
    return counts


def build_product_analytics(period: str, product: str = "all") -> dict:
    period = period if period in PERIODS else "week"
    product = product if product in ("all", "practice", "enterprise") else "all"

    cache_key = f"product_analytics:v1:{period}:{product}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    now, start, prev_start, days = _period_bounds(period)
    tz = timezone.get_current_timezone()

    paid_qs = PaymentOrder.objects.filter(
        status=PaymentOrder.Status.PAID,
        paid_at__isnull=False,
        paid_at__gte=start,
    )
    revenue_total = paid_qs.aggregate(total=Sum("amount"))["total"] or 0
    revenue_by_plan = {
        str(item["plan"] or "topup"): item["total"]
        for item in paid_qs.values("plan")
        .annotate(total=Sum("amount"))
        .order_by()
    }
    revenue_daily = list(
        paid_qs.order_by()
        .annotate(day=TruncDate("paid_at", tzinfo=tz))
        .values("day")
        .annotate(total=Sum("amount"))
        .order_by("day")
    )

    referral_counts = {source: 0 for source in SOURCES}
    for item in (
        ReferralVisit.objects.filter(visited_at__gte=start)
        .order_by()
        .values("source")
        .annotate(count=Count("id"))
    ):
        src = item["source"] if item["source"] in referral_counts else "other"
        referral_counts[src] = referral_counts.get(src, 0) + item["count"]

    new_users = User.objects.filter(date_joined__gte=start).count()
    active_users = User.objects.filter(last_login__gte=start).count()
    # Users active in both the previous window and the current window.
    retained_users = User.objects.filter(
        last_login__gte=start,
        pk__in=User.objects.filter(
            last_login__gte=prev_start, last_login__lt=start
        ).values("pk"),
    ).count()

    plans = {item["subscription_plan"]: item["count"] for item in User.objects.order_by().values("subscription_plan").annotate(count=Count("id"))}
    plans["sponsored"] = User.objects.filter(sponsorship_campaign__isnull=False).count()

    ph_features = _posthog_feature_usage(start, product)
    features = ph_features if ph_features is not None else _db_feature_usage(start, product)

    ph_active = _posthog_active_users(start)
    ph_new = _posthog_new_users(start)
    ph_acquisition = _posthog_acquisition(start)

    payload = {
        "period": period,
        "product": product,
        "window_days": days,
        "sources": {
            "revenue": "database",
            "users": "posthog" if ph_active is not None else "database",
            "features": "posthog" if ph_features is not None else "database",
            "acquisition": "posthog" if ph_acquisition is not None else "database",
        },
        "revenue": {
            "total_paise": revenue_total,
            "by_plan": revenue_by_plan,
            "daily": [
                {"day": item["day"].isoformat(), "amount": item["total"]}
                for item in revenue_daily
            ],
        },
        "users": {
            "new": ph_new if ph_new is not None else new_users,
            "active": ph_active if ph_active is not None else active_users,
            "retained": retained_users,
        },
        "acquisition": ph_acquisition if ph_acquisition is not None else referral_counts,
        "plans": plans,
        "features": features,
        "practice": {
            "interviews_started": _product_session_qs("practice")
            .filter(started_at__gte=start)
            .count(),
            "interviews_completed": _product_session_qs("practice")
            .filter(
                started_at__gte=start,
                status=InterviewSession.Status.COMPLETED,
            )
            .count(),
        },
        "enterprise": {
            "invites_sent": OrgCandidateInvite.objects.filter(created_at__gte=start).count(),
            "interviews_started": _product_session_qs("enterprise")
            .filter(started_at__gte=start)
            .count(),
            "interviews_completed": _product_session_qs("enterprise")
            .filter(
                started_at__gte=start,
                status=InterviewSession.Status.COMPLETED,
            )
            .count(),
        },
    }

    cache.set(cache_key, payload, timeout=settings.CACHE_PRODUCT_ANALYTICS_TTL)
    return payload
