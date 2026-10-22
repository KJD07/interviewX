"""
Job <-> candidate-profile match score (0–100) for "Best match" on Live jobs.
Deterministic and local: skill overlap via the skill graph, role-title
overlap with the candidate's target/recent titles, seniority fit, and the
candidate's work-mode / location preferences.
"""

import re
from dataclasses import dataclass, field

from django.db.models import Q

from . import skillgraph
from .models import Job

_WORD_RE = re.compile(r"[a-z0-9+#.]+")
_STOP = {"and", "of", "the", "for", "in", "at", "to", "a", "an", "with", "i", "ii", "iii", "-", "&"}
LEVEL_ORDER = [Job.Level.ENTRY, Job.Level.MID, Job.Level.SENIOR]


def _words(text: str) -> set[str]:
    return {w for w in _WORD_RE.findall((text or "").lower()) if w not in _STOP}


@dataclass
class Signals:
    skills: set[str] = field(default_factory=set)
    roles: list[set[str]] = field(default_factory=list)
    level: str = ""
    work_modes: set[str] = field(default_factory=set)
    locations: list[str] = field(default_factory=list)

    @property
    def usable(self) -> bool:
        return bool(self.skills or self.roles)


def level_for_years(years) -> str:
    if years is None:
        return ""
    years = float(years)
    if years < 1:
        return Job.Level.ENTRY
    return Job.Level.MID if years < 5 else Job.Level.SENIOR


def signals_for(profile) -> Signals:
    if profile is None:
        return Signals()
    raw = [str(s) for s in profile.skills or []]
    skills = skillgraph.expand(skillgraph.extract_skills(", ".join(raw)) | {s.lower() for s in raw})
    titles = list(profile.target_roles or [])
    if not titles:
        titles = [profile.headline] + [e.get("title", "") for e in (profile.experience or [])[:2]]
    roles = [w for w in (_words(t) for t in titles) if w]
    return Signals(
        skills=skills,
        roles=roles,
        level=profile.experience_level or level_for_years(profile.total_experience_years),
        work_modes=set(profile.work_modes or []),
        locations=[l.lower() for l in profile.preferred_locations or [] if l],
    )


def candidate_filter(sig: Signals) -> Q:
    """Cheap SQL pre-filter: jobs sharing a title word or a skill with the profile."""
    q = Q()
    for words in sig.roles:
        for w in words:
            if len(w) > 2:
                q |= Q(title__icontains=w)
    for s in sorted(sig.skills)[:25]:
        q |= Q(skills__contains=[s])
    return q


def match_score(job: Job, sig: Signals) -> int | None:
    if not sig.usable:
        return None
    job_skills = set(job.skills or [])
    title = _words(job.title)
    role = max((len(r & title) / len(r) for r in sig.roles), default=0.0)
    if sig.level and job.level:
        gap = abs(LEVEL_ORDER.index(sig.level) - LEVEL_ORDER.index(job.level))
        level = (1.0, 0.4, 0.0)[gap]
    else:
        level = 0.5
    if job_skills:
        skill = len(job_skills & sig.skills) / len(job_skills)
        score = 0.5 * skill + 0.3 * role + 0.2 * level
    else:
        score = 0.65 * role + 0.35 * level
    # Preferences nudge, never dominate.
    if sig.work_modes and job.work_mode:
        score += 0.05 if job.work_mode in sig.work_modes else -0.1
    if sig.locations and job.work_mode != Job.WorkMode.REMOTE:
        loc = (job.location or "").lower()
        score += 0.05 if any(l in loc for l in sig.locations) else -0.05
    return max(0, min(100, round(score * 100)))
