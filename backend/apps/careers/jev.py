"""
Optional TypeSafe "Jev" second opinion on an ATS check.

Jev is a decision model (typed Score / Noul answers, no text generation, no
document parsing), so it is used only to *judge* resume text we already
extracted locally:
  * one Score question  -> overall resume/job fit (0-100)
  * one Noul question per keyword the local matcher found missing -> catches
    skills the resume demonstrates in different words ("deployed containers").
Disabled unless TYPESAFE_API_KEY is set; any failure returns None so the
deterministic keyword result is always still served.
"""

import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

URL = "https://api.typesafe.ai/v1/systemone"
TIMEOUT = 8
MAX_SKILL_QUESTIONS = 10
CONFIRM_THRESHOLD = 0.75
RESUME_CHARS = 8_000
JOB_CHARS = 4_000
FIT_LEVELS = ["No relevant match", "Weak match", "Partial match", "Good match", "Excellent match"]


def enabled() -> bool:
    return bool(settings.TYPESAFE_API_KEY)


def assess(resume: str, job_title: str, job_description: str, missing: list[str]) -> dict | None:
    """Returns {"fit": 0-100, "confirmed": [skills]} or None if unavailable."""
    if not enabled():
        return None
    skills = missing[:MAX_SKILL_QUESTIONS]
    questions = {
        "fit": {
            "type": "score",
            "instructions": "How well does this candidate's resume fit the job posting?",
            "criteria": FIT_LEVELS,
        }
    }
    for i, skill in enumerate(skills):
        questions[f"s{i}"] = {
            "type": "noul",
            "instructions": f"Does the resume show real hands-on experience with {skill}?",
            "criteria": {"true": f"The resume demonstrates {skill}", "false": f"The resume does not demonstrate {skill}"},
        }
    state = f"JOB POSTING\nTitle: {job_title}\n{job_description[:JOB_CHARS]}\n\nRESUME\n{resume[:RESUME_CHARS]}"
    try:
        resp = httpx.post(
            URL,
            headers={"Authorization": f"Bearer {settings.TYPESAFE_API_KEY}"},
            json={"state": state, "model": settings.TYPESAFE_MODEL, "questions": questions},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        answers = resp.json()["answers"]
        fit = round(100 * float(answers["fit"]["score"]) / (len(FIT_LEVELS) - 1))
        confirmed = [s for i, s in enumerate(skills) if float(answers[f"s{i}"]["noul"]) >= CONFIRM_THRESHOLD]
    except Exception as exc:  # network, auth, shape — never break the ATS check
        logger.warning("Jev assessment failed: %s", type(exc).__name__)
        return None
    return {"fit": max(0, min(100, fit)), "confirmed": confirmed}
