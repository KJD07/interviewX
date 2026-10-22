"""
Free, keyless public job feeds (no API cost). Refreshed lazily — at most once
per JOB_REFRESH_HOURS — by whichever request first finds the feed stale,
since this stack has no cron/Celery worker.
"""

import html
import logging
import re
from datetime import datetime, timedelta, timezone as dt_tz

import httpx
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Job, JobFeedState

logger = logging.getLogger(__name__)

REMOTIVE_URL = "https://remotive.com/api/remote-jobs?limit=100"
ARBEITNOW_URL = "https://www.arbeitnow.com/api/job-board-api"
TIMEOUT = 10
KEEP_DAYS = 30
_TAG_RE = re.compile(r"<[^>]+>")


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(_TAG_RE.sub(" ", text or ""))).strip()


def _parse_dt(value) -> datetime:
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=dt_tz.utc)
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=dt_tz.utc)
    except ValueError:
        return timezone.now()


def fetch_remotive() -> list[dict]:
    data = httpx.get(REMOTIVE_URL, timeout=TIMEOUT).raise_for_status().json()
    return [
        {
            "source": "remotive", "external_id": str(j["id"]), "title": j["title"][:300],
            "company": j.get("company_name", "")[:200],
            "location": j.get("candidate_required_location", "")[:200],
            "url": j["url"], "description": _clean(j.get("description", "")),
            "tags": list(j.get("tags") or [])[:20], "posted_at": _parse_dt(j.get("publication_date")),
        }
        for j in data.get("jobs", [])
    ]


def fetch_arbeitnow() -> list[dict]:
    data = httpx.get(ARBEITNOW_URL, timeout=TIMEOUT).raise_for_status().json()
    return [
        {
            "source": "arbeitnow", "external_id": j["slug"], "title": j["title"][:300],
            "company": j.get("company_name", "")[:200], "location": j.get("location", "")[:200],
            "url": j["url"], "description": _clean(j.get("description", "")),
            "tags": list(j.get("tags") or [])[:20], "posted_at": _parse_dt(j.get("created_at")),
        }
        for j in data.get("data", [])
    ]


FETCHERS = (fetch_remotive, fetch_arbeitnow)


def refresh_jobs() -> tuple[int, list[str]]:
    """Pull every feed (one failing feed doesn't block the others). Returns jobs upserted."""
    count, errors = 0, []
    for fetch in FETCHERS:
        try:
            rows = fetch()
        except Exception as exc:  # network/shape errors must never break the request
            logger.warning("job feed %s failed: %s", fetch.__name__, exc)
            errors.append(f"{fetch.__name__}: {exc}"[:100])
            continue
        for row in rows:
            key = {"source": row.pop("source"), "external_id": row.pop("external_id")}
            Job.objects.update_or_create(**key, defaults=row)
            count += 1
    Job.objects.filter(posted_at__lt=timezone.now() - timedelta(days=KEEP_DAYS)).delete()
    return count, errors


def refresh_if_stale() -> bool:
    """Refresh if the last attempt was >= JOB_REFRESH_HOURS ago. The row lock
    ensures concurrent requests trigger a single refresh."""
    interval = timedelta(hours=settings.JOB_REFRESH_HOURS)
    with transaction.atomic():
        state, _ = JobFeedState.objects.select_for_update().get_or_create(pk=1)
        if state.last_refreshed_at and timezone.now() - state.last_refreshed_at < interval:
            return False
        # Stamp before fetching: a failing feed is retried next interval, not on every request.
        state.last_refreshed_at = timezone.now()
        state.save(update_fields=["last_refreshed_at"])
        _, errors = refresh_jobs()
        state.last_error = "; ".join(errors)[:300]
        state.save(update_fields=["last_error"])
    return True
