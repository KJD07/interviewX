"""
Cache-aside helpers for infrequently-changing read paths (issue #61).

Company catalog (GET /api/companies/)
-------------------------------------
Responses are keyed by (catalog_version, kind, effective_plan) because the
list is filtered per plan tier. ``invalidate_company_catalog_cache()`` bumps
``catalog_version`` so old entries are never read again; they expire via TTL.

Call invalidation after:
- ``import_spreadsheet`` (admin upload)
- ``seed_companies`` / ``seed_skills`` management commands
- AI question generation on a public round (``GenerateRoundQuestionsView``)

Enterprise dashboard aggregates (GET /api/enterprise/dashboard/)
--------------------------------------------------------------
``invite_counts``, ``invite_series``, and ``recent_activity`` are cached per
organization id with a short TTL. ``invalidate_enterprise_dashboard_cache``
is called when invites are created or a candidate starts an interview; the
TTL covers session completion and other edge paths.

Redis: uses logical DB 1 when ``REDIS_URL`` / ``REDIS_HOST`` is set (RQ uses
DB 0). Without Redis, Django's LocMem backend is used (tests / no compose).
"""

from __future__ import annotations

from django.conf import settings
from django.core.cache import cache

CATALOG_VERSION_KEY = "read_cache:companies:catalog_version"


def get_company_catalog_version() -> int:
    return cache.get(CATALOG_VERSION_KEY, 0)


def invalidate_company_catalog_cache() -> None:
    """Drop all company/skill list cache entries (version bump)."""
    try:
        cache.incr(CATALOG_VERSION_KEY)
    except ValueError:
        cache.set(CATALOG_VERSION_KEY, 1, timeout=None)


def company_list_cache_key(kind: str, plan: str) -> str:
    return f"read_cache:companies:list:v{get_company_catalog_version()}:{kind}:{plan}"


def get_cached_company_list(kind: str, plan: str):
    return cache.get(company_list_cache_key(kind, plan))


def set_cached_company_list(kind: str, plan: str, payload) -> None:
    cache.set(
        company_list_cache_key(kind, plan),
        payload,
        timeout=settings.CACHE_COMPANY_LIST_TTL,
    )


def enterprise_dashboard_aggregates_key(organization_id: int) -> str:
    return f"read_cache:enterprise:dashboard:agg:{organization_id}"


def get_cached_enterprise_dashboard_aggregates(organization_id: int):
    return cache.get(enterprise_dashboard_aggregates_key(organization_id))


def set_cached_enterprise_dashboard_aggregates(organization_id: int, payload: dict) -> None:
    cache.set(
        enterprise_dashboard_aggregates_key(organization_id),
        payload,
        timeout=settings.CACHE_ENTERPRISE_DASHBOARD_TTL,
    )


def invalidate_enterprise_dashboard_cache(organization_id: int) -> None:
    cache.delete(enterprise_dashboard_aggregates_key(organization_id))
