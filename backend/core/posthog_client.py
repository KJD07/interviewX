"""Optional PostHog server-side capture — never blocks request handling."""

from __future__ import annotations

import logging
import threading
from typing import Any

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


def posthog_enabled() -> bool:
    return bool(settings.POSTHOG_PROJECT_API_KEY and settings.POSTHOG_HOST)


def capture_event(
    distinct_id: str,
    event: str,
    properties: dict[str, Any] | None = None,
) -> None:
    """Fire-and-forget capture to PostHog. No-op when not configured."""
    if not posthog_enabled():
        return

    payload = {
        "api_key": settings.POSTHOG_PROJECT_API_KEY,
        "event": event,
        "distinct_id": str(distinct_id),
        "properties": properties or {},
    }

    def _send() -> None:
        try:
            httpx.post(
                f"{settings.POSTHOG_HOST.rstrip('/')}/capture/",
                json=payload,
                timeout=5.0,
            )
        except Exception:
            logger.debug("PostHog capture failed for %s", event, exc_info=True)

    threading.Thread(target=_send, daemon=True).start()


def hogql_query(sql: str) -> list[dict[str, Any]] | None:
    """Run a HogQL query via PostHog Query API. Returns None if not configured."""
    if not (
        settings.POSTHOG_PERSONAL_API_KEY
        and settings.POSTHOG_PROJECT_ID
        and settings.POSTHOG_HOST
    ):
        return None

    url = (
        f"{settings.POSTHOG_HOST.rstrip('/')}/api/projects/"
        f"{settings.POSTHOG_PROJECT_ID}/query/"
    )
    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {settings.POSTHOG_PERSONAL_API_KEY}"},
            json={"query": {"kind": "HogQLQuery", "query": sql}},
            timeout=20.0,
        )
        response.raise_for_status()
        body = response.json()
        columns = body.get("columns") or []
        results = body.get("results") or []
        rows: list[dict[str, Any]] = []
        for row in results:
            rows.append({columns[i]: row[i] for i in range(len(columns))})
        return rows
    except Exception:
        logger.debug("PostHog HogQL query failed", exc_info=True)
        return None
