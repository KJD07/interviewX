"""Deterministic, zero-cost ATS scoring of a resume against a job posting."""

from . import skillgraph

MAX_TEXT_CHARS = 30_000


def ats_check(resume_text: str, job_title: str, job_description: str, job_tags=None) -> dict:
    resume_text = (resume_text or "")[:MAX_TEXT_CHARS]
    job_blob = f"{job_title}\n{' '.join(job_tags or [])}\n{(job_description or '')[:MAX_TEXT_CHARS]}"
    # Title/tags mentions count double: recruiters weight them most.
    required = skillgraph.extract_skills(job_blob)
    title_skills = skillgraph.extract_skills(f"{job_title} {' '.join(job_tags or [])}")

    have = skillgraph.expand(skillgraph.extract_skills(resume_text))
    weights = {s: (2 if s in title_skills else 1) for s in required}
    total = sum(weights.values())
    matched = sorted(s for s in required if s in have)
    missing = sorted((s for s in required if s not in have), key=lambda s: (-weights[s], s))

    if total == 0:
        score = None  # nothing recognisable in the posting to score against
    else:
        score = round(100 * sum(weights[s] for s in matched) / total)
    return {"ats_score": score, "matched_keywords": matched, "missing_keywords": missing}
