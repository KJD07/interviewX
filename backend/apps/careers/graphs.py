"""
Careers ATS check expressed as a graph (see core/graph.py).

  parse_resume -> load_job -> keyword_score -> quota_precheck
    -> jev_assess (only if Jev is enabled) -> rescore (only if Jev answered) -> save
  Any node that sets state["response"] ends the run (400/404/422/429), so an
  over-quota user never reaches the paid Jev call.
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.subscriptions.plans import ats_daily_limit
from core.graph import END, Graph

from . import feeds, jev
from .ats import MAX_TEXT_CHARS, ats_check
from .models import CandidateProfile, Job, ResumeCheck
from .resume_parser import ResumeParseError, extract_text

MIN_RESUME_CHARS = 100


def _stop_or(next_node):
    """Router: end the run once a node has produced the final response."""
    return lambda state: END if "response" in state else next_node


def _reply(body, status=200):
    return {"response": (status, body)}


# ---------------------------------------------------------------------------
# ATS check
# ---------------------------------------------------------------------------

def quota(user):
    """(limit|None, used_today)"""
    today = timezone.localdate()
    used = ResumeCheck.objects.filter(user=user, created_at__date=today).count()
    return ats_daily_limit(user), used


def _limit_reply(limit, used):
    return _reply(
        {"detail": f"Daily limit of {limit} resume checks reached. Get ATS Unlimited (₹199/month) "
                   f"for unlimited checks.",
         "code": "ats_daily_limit", "ats_quota": {"limit": limit, "used": used}},
        429,
    )


def _parse_resume(state):
    upload = state.get("upload")  # (filename, bytes) or None
    if upload:
        try:
            resume = extract_text(*upload)
        except ResumeParseError as exc:
            return _reply({"detail": str(exc)}, 400)
    else:
        resume = (state.get("resume_text") or "").strip()
        if not resume:  # nothing sent -> the resume saved on the candidate's profile
            resume = (CandidateProfile.objects.filter(user=state["user"])
                      .values_list("resume_text", flat=True).first() or "")
    resume = resume[:MAX_TEXT_CHARS]
    if len(resume) < MIN_RESUME_CHARS:
        return _reply({"detail": "Upload your resume or paste its full text (at least 100 characters)."}, 400)
    return {"resume": resume}


def _load_job(state):
    job = Job.objects.filter(pk=state["job_id"]).first()
    if not job:
        return _reply({"detail": "Job not found."}, 404)
    return {"job": feeds.ensure_description(job)}


def _ats_keyword_score(state):
    job = state["job"]
    result = ats_check(state["resume"], job.title, job.description, job.tags)
    if result["ats_score"] is None:
        return _reply({"detail": "This posting lists no recognisable skills to check against."}, 422)
    return {"result": result}


def _quota_precheck(state):
    # Cheap un-locked pre-check so over-quota users never trigger a paid Jev call.
    limit, used = quota(state["user"])
    if limit is not None and used >= limit:
        return _limit_reply(limit, used)


def _jev_assess(state):
    job = state["job"]
    return {"ai": jev.assess(state["resume"], job.title, job.description, state["result"]["missing_keywords"])}


def _rescore(state):
    job, ai = state["job"], state["ai"]
    result = ats_check(state["resume"], job.title, job.description, job.tags, extra_have=ai["confirmed"])
    result["ai_fit"] = ai["fit"]
    return {"result": result}


def _save(state):
    result = dict(state["result"])
    result["ai_assisted"] = bool(state.get("ai"))
    job = state["job"]
    # Serialise per user so parallel requests can't slip past the daily cap.
    with transaction.atomic():
        user = get_user_model().objects.select_for_update().get(pk=state["user"].pk)
        limit, used = quota(user)
        if limit is not None and used >= limit:
            return _limit_reply(limit, used)
        ResumeCheck.objects.create(
            user=user, job=job, ats_score=result["ats_score"],
            matched_keywords=result["matched_keywords"], missing_keywords=result["missing_keywords"],
        )
    result["ats_quota"] = {"limit": limit, "used": used + 1}
    return _reply(result)


ats_graph = (
    Graph("ats_check")
    .node("parse_resume", _parse_resume)
    .node("load_job", _load_job)
    .node("keyword_score", _ats_keyword_score)
    .node("quota_precheck", _quota_precheck)
    .node("jev_assess", _jev_assess)
    .node("rescore", _rescore)
    .node("save", _save)
    .route("parse_resume", _stop_or("load_job"))
    .route("load_job", _stop_or("keyword_score"))
    .route("keyword_score", _stop_or("quota_precheck"))
    .route("quota_precheck", lambda s: END if "response" in s else ("jev_assess" if jev.enabled() else "save"))
    .route("jev_assess", lambda s: "rescore" if s.get("ai") else "save")
    .on_error("jev_assess", "save")
    .edge("rescore", "save")
)


def run_ats_check(user, job_id, upload=None, resume_text=""):
    """Returns (http_status, body, trace)."""
    state, trace = ats_graph.run({"user": user, "job_id": job_id, "upload": upload, "resume_text": resume_text})
    status, body = state["response"]
    return status, body, trace
