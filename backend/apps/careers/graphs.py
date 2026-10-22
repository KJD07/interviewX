"""
Careers pipelines expressed as graphs (see core/graph.py).

ATS check:
  parse_resume -> load_job -> keyword_score -> quota_precheck
    -> jev_assess (only if Jev is enabled) -> rescore (only if Jev answered) -> save
  Any node that sets state["response"] ends the run (400/404/422/429), so an
  over-quota user never reaches the paid Jev call.

Practice answer:
  keyword_score -> (blank/short, confident, or Jev off: done)
    -> jev_grade -> combine
  Jev is only asked about answers the keyword scorer is unsure of, and any
  Jev failure falls back to the keyword result.
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.subscriptions.plans import ats_daily_limit
from core.graph import END, Graph

from . import jev
from .ats import MAX_TEXT_CHARS, ats_check
from .models import Job, ResumeCheck
from .practice import score_answer
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
    resume = resume[:MAX_TEXT_CHARS]
    if len(resume) < MIN_RESUME_CHARS:
        return _reply({"detail": "Upload your resume or paste its full text (at least 100 characters)."}, 400)
    return {"resume": resume}


def _load_job(state):
    job = Job.objects.filter(pk=state["job_id"]).first()
    if not job:
        return _reply({"detail": "Job not found."}, 404)
    return {"job": job}


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


# ---------------------------------------------------------------------------
# Practice answer grading
# ---------------------------------------------------------------------------

MIN_WORDS_FOR_AI = 8          # shorter answers are graded by keywords alone
CONFIDENT_LOW, CONFIDENT_HIGH = 3, 8
KEYWORD_WEIGHT = 0.4
MAX_AI_BOOST = 4              # Jev can lift a score at most this far above keywords


def _practice_keyword_score(state):
    result = score_answer(state["answer"], state["ideal"])
    result.update(ai_assisted=False, method="keyword")
    return {"result": result}


def _needs_second_opinion(state):
    score = state["result"]["score"]
    if len(state["answer"].split()) < MIN_WORDS_FOR_AI:
        return END
    if score < CONFIDENT_LOW or score >= CONFIDENT_HIGH or not jev.enabled():
        return END
    return "jev_grade"


def _jev_grade(state):
    return {"jev_grade": jev.grade_answer(state["question"], state["ideal"], state["answer"])}


def _combine(state):
    keyword = state["result"]["score"]
    ai = state["jev_grade"] / (len(jev.ANSWER_LEVELS) - 1) * 10
    final = KEYWORD_WEIGHT * keyword + (1 - KEYWORD_WEIGHT) * ai
    # Clamp the upside: answer text is model input, so cap how far a crafted
    # answer can inflate the score over what the keyword check found.
    final = max(0.0, min(10.0, final, keyword + MAX_AI_BOOST))
    return {"result": {**state["result"], "score": round(final, 1), "ai_assisted": True, "method": "keyword+jev"}}


practice_graph = (
    Graph("practice_answer")
    .node("keyword_score", _practice_keyword_score)
    .node("jev_grade", _jev_grade)
    .node("combine", _combine)
    .route("keyword_score", _needs_second_opinion)
    .route("jev_grade", lambda s: "combine" if s.get("jev_grade") is not None else END)
    .on_error("jev_grade", END)
)


def run_practice(question: str, ideal: str, answer: str):
    """Returns (result, trace)."""
    state, trace = practice_graph.run({"question": question, "ideal": ideal, "answer": answer})
    return state["result"], trace
