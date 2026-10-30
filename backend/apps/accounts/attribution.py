"""Sanitize the client-reported marketing attribution sent at signup.

The frontend (`lib/attribution.ts`) stores a first-touch and a last-touch
snapshot of UTM params / click ids / referrer and posts them with the
register and Google sign-in requests. It's untrusted input, so only known
keys survive and every value is a short string.
"""

from urllib.parse import urlparse

TOUCH_KEYS = (
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "li_fat_id",
    "ref",
    "referrer",
    "landing_page",
    "captured_at",
)
MAX_VALUE_LEN = 300


def _clean_touch(raw) -> dict:
    if not isinstance(raw, dict):
        return {}
    touch = {}
    for key in TOUCH_KEYS:
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            touch[key] = value.strip()[:MAX_VALUE_LEN]
    return touch


def clean_attribution(raw) -> dict:
    if not isinstance(raw, dict):
        return {}
    cleaned = {}
    for touch in ("first_touch", "last_touch"):
        value = _clean_touch(raw.get(touch))
        if value:
            cleaned[touch] = value
    return cleaned


def source_from_attribution(attribution: dict) -> str:
    """utm_source of the first touch, else the referrer's host, else direct."""
    touch = attribution.get("first_touch") or attribution.get("last_touch") or {}
    source = touch.get("utm_source", "").lower()
    if not source and touch.get("referrer"):
        source = urlparse(touch["referrer"]).hostname or ""
        source = source.lower().removeprefix("www.")
    return (source or "direct")[:64]


def apply_signup_attribution(user, raw) -> list[str]:
    """Set the attribution fields on a user that has none yet. Returns the
    changed field names (caller saves)."""
    if user.signup_attribution:
        return []
    attribution = clean_attribution(raw)
    user.signup_attribution = attribution
    user.signup_source = source_from_attribution(attribution)
    return ["signup_attribution", "signup_source"]
