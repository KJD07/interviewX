from datetime import datetime, timedelta

from django.utils import timezone

from apps.interviews.models import InterviewSession

from .models import OrgCandidateInvite

INVITE_SERIES_WEEKS = 12
RECENT_ACTIVITY_LIMIT = 8


def _iso_week_start(dt):
    local = timezone.localtime(dt)
    d = local.date()
    return d - timedelta(days=d.weekday())


def invite_series(organization, weeks=INVITE_SERIES_WEEKS):
    """Weekly invite counts for the last `weeks` ISO weeks (Monday start),
    oldest first, including weeks with zero invites so a sparkline stays even."""
    now = timezone.now()
    this_week = _iso_week_start(now)
    buckets = [this_week - timedelta(weeks=i) for i in range(weeks - 1, -1, -1)]
    cutoff_naive = datetime.combine(buckets[0], datetime.min.time())
    tz = timezone.get_current_timezone()
    cutoff = timezone.make_aware(cutoff_naive, tz) if timezone.is_naive(cutoff_naive) else cutoff_naive

    counts = {}
    for created_at in OrgCandidateInvite.objects.filter(
        organization=organization, created_at__gte=cutoff
    ).values_list("created_at", flat=True):
        week = _iso_week_start(created_at)
        counts[week] = counts.get(week, 0) + 1

    return [{"week_start": week.isoformat(), "count": counts.get(week, 0)} for week in buckets]


def _format_relative(dt, now):
    if dt is None:
        return ""
    seconds = int((now - dt).total_seconds())
    if seconds < 0:
        ahead = -seconds
        if ahead < 3600:
            return "soon"
        hours = ahead // 3600
        if hours < 24:
            return f"in {hours} hour{'s' if hours != 1 else ''}"
        days = hours // 24
        if days == 1:
            return "tomorrow"
        return f"in {days} days"
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    days = hours // 24
    if days == 1:
        return "yesterday"
    if days < 14:
        return f"{days} days ago"
    return timezone.localtime(dt).strftime("%d %b")


def recent_activity(organization, limit=RECENT_ACTIVITY_LIMIT):
    """One row per invite reflecting its latest state (live / finished /
    pending / expired), newest first — same mix the marketing preview shows,
    derived from real invites and linked sessions."""
    now = timezone.now()
    invites = (
        OrgCandidateInvite.objects.filter(organization=organization)
        .select_related("round", "session")
        .order_by("-created_at")[:50]
    )

    events = []
    for inv in invites:
        round_title = inv.round.title
        email = inv.candidate_email
        session = inv.session

        if session is not None and session.status == InterviewSession.Status.IN_PROGRESS:
            events.append({
                "text": f"{email} started {round_title}",
                "occurred_at": session.started_at,
                "live": True,
            })
            continue

        if session is not None and session.status in (
            InterviewSession.Status.COMPLETED,
            InterviewSession.Status.ABANDONED,
        ):
            overall = session.scores.get("overall") if isinstance(session.scores, dict) else None
            score_bit = f" — {overall}/10" if overall is not None else ""
            verb = "finished" if session.status == InterviewSession.Status.COMPLETED else "left"
            events.append({
                "text": f"{email} {verb} {round_title}{score_bit}",
                "occurred_at": session.ended_at or session.started_at,
                "live": False,
            })
            continue

        if inv.status == OrgCandidateInvite.Status.EXPIRED or (
            inv.status == OrgCandidateInvite.Status.PENDING and inv.is_expired
        ):
            events.append({
                "text": f"{email} invite expired",
                "occurred_at": inv.expires_at,
                "live": False,
            })
            continue

        events.append({
            "text": f"{email} invited to {round_title}",
            "occurred_at": inv.created_at,
            "live": False,
        })

    events.sort(key=lambda e: e["occurred_at"] or now, reverse=True)
    out = []
    for event in events[:limit]:
        out.append({
            "text": event["text"],
            "when": event.get("when") or _format_relative(event["occurred_at"], now),
            "live": event["live"],
        })
    return out
