"""
Role-based practice: every question likely to come up for one tracked
application (JobApplication), assembled with zero API cost from

  1. the company's own question bank, when the company is in the catalog
     (apps/companies Company kind="company", role picked by title overlap),
  2. skill tracks from the curated skill bank (Company kind="skill"), picked
     from the skills in the posting plus defaults for the role family, and
  3. careers/practice_library.py — role-fit questions, extra coding problems,
     and questions for roles no skill track covers.

No LLM is called: picking is keyword matching and scoring is
careers/practice.score_answer.
"""

from __future__ import annotations

import re

from apps.companies.models import Company, InterviewQuestion
from apps.subscriptions.plans import effective_plan

from . import practice_library as lib
from .skillgraph import extract_skills

COMPANY_CAP = 30  # questions from the company's own bank
TRACK_CAP = 9     # questions per skill track
MAX_TRACKS = 6
BEHAVIORAL_TRACK = "HR & Behavioral"

# Canonical skill (careers/skillgraph) -> skill-bank track name.
SKILL_TRACKS = {
    "javascript": "JavaScript", "typescript": "TypeScript", "react": "React", "html": "HTML & CSS",
    "css": "HTML & CSS", "next.js": "Next.js", "python": "Python", "java": "Java", "node.js": "Node.js",
    "django": "Django", "spring boot": "Spring Boot", "sql": "SQL", "postgresql": "SQL", "mysql": "SQL",
    "mongodb": "MongoDB", "nosql": "MongoDB", "algorithms": "Data Structures & Algorithms",
    "design patterns": "OOP", "system design": "System Design", "microservices": "System Design",
    "docker": "Docker", "kubernetes": "Kubernetes", "aws": "AWS", "git": "Git", "linux": "Operating Systems",
    "machine learning": "Machine Learning", "deep learning": "Machine Learning",
    "data analysis": "Data Analysis", "pandas": "Data Analysis", "excel": "Data Analysis",
    "data visualization": "Data Analysis",
}

# (family, title pattern, default skill tracks, extra library questions). First match wins.
_DSA, _OOP, _SD = "Data Structures & Algorithms", "OOP", "System Design"
ROLE_FAMILIES = [
    ("product", r"\bproduct (?:manager|owner|lead)|\bapm\b|\bpm\b", [], lib.FAMILY_QUESTIONS["product"]),
    ("design", r"\b(?:ux|ui|product|visual|graphic|interaction) designer|\bdesigner\b", [],
     lib.FAMILY_QUESTIONS["design"]),
    ("qa", r"\bqa\b|\bsdet\b|\btest(?:ing|er)?\b|quality (?:assurance|engineer)", [_OOP, "SQL"],
     lib.FAMILY_QUESTIONS["qa"]),
    ("data_science", r"data scien|machine learning|\bml\b|\bai\b|deep learning|\bnlp\b|computer vision",
     ["Machine Learning", "Python", "SQL", "Data Analysis"], lib.SQL_CODING),
    ("data_analyst", r"\b(?:data|business|product|bi|mis) analyst|analytics", ["SQL", "Data Analysis"],
     lib.SQL_CODING),
    ("data_engineer", r"data engineer|\betl\b|big data", ["SQL", "Python", _SD], lib.SQL_CODING),
    ("devops", r"devops|\bsre\b|site reliability|cloud|platform engineer|infrastructure",
     ["Docker", "Kubernetes", "AWS", "Operating Systems", "Computer Networks", "Git"], []),
    ("frontend", r"front[\s-]?end|\bui (?:developer|engineer)|react|angular|\bweb developer",
     ["JavaScript", "React", "HTML & CSS", _DSA], lib.ENGINEERING_CODING),
    ("engineering", r"engineer|developer|\bsde\b|programmer|software|full[\s-]?stack|back[\s-]?end|architect"
     r"|android|\bios\b|mobile",
     [_DSA, _OOP, "DBMS", _SD, "Operating Systems"], lib.ENGINEERING_CODING),
    ("sales", r"\bsales|business development|\bbde\b|account (?:executive|manager)", [],
     lib.FAMILY_QUESTIONS["sales"]),
    ("marketing", r"marketing|\bseo\b|growth|content|brand|social media", [], lib.FAMILY_QUESTIONS["marketing"]),
    ("hr", r"\bhr\b|human resources|recruit|talent|people (?:ops|partner)", [], lib.FAMILY_QUESTIONS["hr"]),
    ("finance", r"financ|accountant|accounting|audit|\bca\b|investment|analyst", [],
     lib.FAMILY_QUESTIONS["finance"]),
    ("operations", r"operations|\bops\b|supply chain|logistics|customer (?:success|support)|program manager"
     r"|project manager", [], lib.FAMILY_QUESTIONS["operations"]),
]
_FAMILY_RES = [(name, re.compile(pat, re.I), tracks, extra) for name, pat, tracks, extra in ROLE_FAMILIES]

_SUFFIXES = {
    "inc", "incorporated", "ltd", "limited", "pvt", "private", "llc", "llp", "plc", "corp", "corporation", "co",
    "company", "technologies", "technology", "tech", "labs", "india", "software", "solutions", "services", "group",
    "global", "the", "gmbh", "ag", "sa", "holdings",
}
_ROLE_ALIASES = {"sde": "software", "swe": "software", "dev": "developer", "eng": "engineer"}
_WORD = re.compile(r"[a-z0-9+#]+")


def company_key(name: str) -> str:
    """'Microsoft India Pvt. Ltd.' -> 'microsoft'; empty when only suffixes remain."""
    words = _WORD.findall((name or "").lower().replace("&", " and "))
    core = [w for w in words if w not in _SUFFIXES]
    return " ".join(core or words)


def _title_words(title: str) -> set[str]:
    return {_ROLE_ALIASES.get(w, w) for w in _WORD.findall((title or "").lower()) if len(w) > 1}


def role_family(title: str):
    for name, rx, tracks, extra in _FAMILY_RES:
        if rx.search(title or ""):
            return name, tracks, extra
    return "general", [], []


def _category(q_type: str, track: str = "") -> str:
    if q_type == "coding":
        return "coding"
    if q_type == "system_design":
        return "system_design"
    if q_type == "behavioral" or track == BEHAVIORAL_TRACK:
        return "behavioral"
    return "technical"


def question_dict(q: InterviewQuestion, source: str, track: str = "") -> dict:
    return {"id": q.id, "question_text": q.question_text, "question_type": q.question_type,
            "category": _category(q.question_type, track), "source": source,
            "language": q.language if q.question_type == "coding" else "", "starter_code": q.starter_code}


def _lib_dict(q: dict, source: str) -> dict:
    return {"id": f"lib:{q['key']}", "question_text": q["question_text"], "question_type": q["question_type"],
            "category": _category(q["question_type"]), "source": source,
            "language": q.get("language", ""), "starter_code": q.get("starter_code", "")}


def _questions(rounds_filter: dict):
    return (InterviewQuestion.objects
            .filter(status=InterviewQuestion.Status.APPROVED, round__isnull=False, **rounds_filter)
            .exclude(ideal_answer="").exclude(question_type="mcq")
            .order_by("round__role_id", "round__order", "id"))


def match_company(name: str):
    key = company_key(name)
    if not key:
        return None
    for co in Company.objects.filter(kind=Company.Kind.COMPANY, organization__isnull=True):
        if company_key(co.name) == key:
            return co
    return None


def _company_questions(company: Company, title: str) -> tuple[list[dict], str]:
    """The company's bank for the closest role (all roles when none overlaps)."""
    want = _title_words(title)
    roles = list(company.roles.all())
    scored = sorted(((len(want & _title_words(r.title)), r) for r in roles), key=lambda x: -x[0])
    if scored and scored[0][0] > 0:
        role = scored[0][1]
        qs, source = _questions({"round__role": role}), f"{company.name} · {role.title}"
    else:
        qs, source = _questions({"round__role__company": company}), company.name
    return [question_dict(q, source) for q in qs[:COMPANY_CAP]], source


def _posting_skills(app) -> list[str]:
    """Skills in the posting, most specific first (title, then stored job skills)."""
    ordered = sorted(extract_skills(app.title))
    if app.job_id and app.job:
        ordered += [s for s in (app.job.skills or []) if s not in ordered]
    return ordered


def tracks_for(app, family_tracks: list[str]) -> list[str]:
    tracks: list[str] = []
    for skill in _posting_skills(app):
        track = SKILL_TRACKS.get(skill)
        if track and track not in tracks:
            tracks.append(track)
    for track in family_tracks:
        if track not in tracks:
            tracks.append(track)
    return tracks[:MAX_TRACKS] + [BEHAVIORAL_TRACK]


def build_practice_set(app, user) -> dict:
    title = app.job.title if app.job_id and app.job else app.title
    company_name = app.job.company if app.job_id and app.job else app.company
    plan = effective_plan(user)
    family, family_tracks, extra = role_family(title)

    questions: list[dict] = []
    sources: list[str] = []
    company_bank = False
    company = match_company(company_name)
    if company and company.is_accessible_by(plan):
        company_qs, source = _company_questions(company, title)
        if company_qs:
            questions += company_qs
            sources.append(source)
            company_bank = True

    extra_label = "Coding problems" if extra and all(q["question_type"] == "coding" for q in extra) else "Role-specific"
    skill_rows = {c.name: c for c in Company.objects.filter(kind=Company.Kind.SKILL, organization__isnull=True)}
    for track in tracks_for(app, family_tracks):
        if track == BEHAVIORAL_TRACK and extra:  # the role's own questions before the generic HR round
            questions += [_lib_dict(q, extra_label) for q in extra]
            sources.append(extra_label)
            extra = []
        skill = skill_rows.get(track)
        if not skill or not skill.is_accessible_by(plan):
            continue
        rows = [question_dict(q, track, track) for q in _questions({"round__role__company": skill})[:TRACK_CAP]]
        if rows:
            questions += rows
            sources.append(track)

    if extra:  # HR track unavailable
        questions += [_lib_dict(q, extra_label) for q in extra]
        sources.append(extra_label)
    questions += [_lib_dict(q, "Role fit") for q in lib.ROLE_FIT]
    sources.append("Role fit")

    seen, unique = set(), []
    for q in questions:  # a company question may repeat a skill-bank one word for word
        text = q["question_text"].strip().lower()
        if text not in seen:
            seen.add(text)
            unique.append(q)

    return {
        "application": {"id": app.id, "title": title, "company": company_name, "status": app.status},
        "family": family,
        "company_bank": company_bank,
        "sources": sources,
        "questions": unique,
    }


def library_question(key: str):
    return lib.BY_KEY.get(key)
