"""Background interview scoring (issue #60).

When REDIS_URL is configured and INTERVIEW_SCORING_SYNC is not true, end-of-
session grading runs in an RQ worker. Otherwise grading runs inline (tests and
local dev without Redis).
"""

import logging
import os

from django.conf import settings
from django.db import transaction

from .models import InterviewSession

logger = logging.getLogger(__name__)


def scoring_runs_inline() -> bool:
    if os.environ.get("INTERVIEW_SCORING_SYNC", "").lower() in ("1", "true", "yes"):
        return True
    return not getattr(settings, "REDIS_URL", "")


def enqueue_session_scoring(session_id: int, *, time_expired: bool = False) -> None:
    if scoring_runs_inline():
        run_scoring_job(session_id, time_expired=time_expired)
        return

    import django_rq

    queue = django_rq.get_queue("default")
    queue.enqueue(
        run_scoring_job,
        session_id,
        time_expired=time_expired,
        job_timeout=600,
        result_ttl=0,
        failure_ttl=86400,
    )


def begin_session_scoring(session: InterviewSession, *, time_expired: bool = False) -> InterviewSession:
    """Move an in-progress session to scoring and enqueue grading (idempotent)."""
    with transaction.atomic():
        locked = InterviewSession.objects.select_for_update().get(pk=session.pk)
        if locked.status == InterviewSession.Status.COMPLETED:
            return locked
        if locked.status == InterviewSession.Status.SCORING:
            return locked
        if locked.status != InterviewSession.Status.IN_PROGRESS:
            return locked
        locked.status = InterviewSession.Status.SCORING
        locked.scoring_error = ""
        locked.save(update_fields=["status", "scoring_error"])

    enqueue_session_scoring(locked.pk, time_expired=time_expired)
    locked.refresh_from_db()
    return locked


def run_scoring_job(session_id: int, *, time_expired: bool = False) -> None:
    from .views import _score_and_complete_session

    try:
        session = InterviewSession.objects.get(pk=session_id)
    except InterviewSession.DoesNotExist:
        logger.warning("Scoring job skipped — session %s not found", session_id)
        return

    if session.status == InterviewSession.Status.COMPLETED:
        return
    if session.status != InterviewSession.Status.SCORING:
        logger.info(
            "Scoring job skipped — session %s status is %s",
            session_id,
            session.status,
        )
        return

    try:
        result = _score_and_complete_session(session, time_expired=time_expired)
    except Exception:
        logger.exception("Scoring job failed for session %s", session_id)
        InterviewSession.objects.filter(pk=session_id).update(
            scoring_error="Scoring failed. Please try ending the interview again."
        )
        return

    from rest_framework.response import Response

    if isinstance(result, Response):
        detail = "Scoring failed."
        if isinstance(result.data, dict):
            detail = str(result.data.get("detail") or detail)
        InterviewSession.objects.filter(pk=session_id).update(scoring_error=detail[:500])
        logger.error("Scoring job returned error for session %s: %s", session_id, detail)
