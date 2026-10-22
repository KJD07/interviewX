"""
Resume text -> structured candidate profile.

Runs once, when the candidate uploads a resume. With OPENROUTER_API_KEY set,
one cheap LLM call extracts the fields; any failure (no key, network, bad
JSON) falls back to deterministic rules, so upload always fills something
the candidate can then edit by hand.
"""

import json
import logging
import os
import re

from core.openrouter_client import chat_completion

from . import skillgraph

logger = logging.getLogger(__name__)

MAX_PROMPT_CHARS = 12_000
LIST_LIMITS = {"skills": 60, "experience": 15, "education": 8, "projects": 12, "certifications": 15}
ENTRY_FIELDS = {
    "experience": ("title", "company", "location", "start", "end", "description"),
    "education": ("degree", "institution", "start", "end", "grade"),
    "projects": ("name", "description", "link"),
}

PROMPT = """Extract this resume into JSON. Reply with ONLY a JSON object, no prose, with keys:
full_name, headline (current/target title, short), email, phone, location, summary (<= 3 sentences),
linkedin_url, github_url, portfolio_url, total_experience_years (number, 0 for students),
skills (list of short skill names), certifications (list of strings),
experience (list of {title, company, location, start, end, description}; end "Present" if current),
education (list of {degree, institution, start, end, grade}),
projects (list of {name, description, link}).
Use "" for unknown strings. Do not invent anything not in the resume.

RESUME:
"""

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"\+?\(?\d[\d \t().-]{7,16}\d")
URL_RE = re.compile(r"(?:https?://)?(?:www\.)?([a-z0-9-]+\.)+[a-z]{2,}(?:/[^\s,;|]*)?", re.I)
DATE_RANGE_RE = re.compile(
    r"((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*\d{2,4}|\d{1,2}/\d{4}|\d{4})"
    r"\s*(?:-|–|—|to)\s*"
    r"((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*\d{2,4}|\d{1,2}/\d{4}|\d{4}|present|current|now)",
    re.I,
)
YEARS_EXP_RE = re.compile(r"(\d{1,2}(?:\.\d)?)\s*\+?\s*years? of (?:professional |industry |work )?experience", re.I)
SECTION_RE = re.compile(
    r"^\s*(professional summary|summary|profile|objective|about me|work experience|professional experience|"
    r"experience|employment history|internships?|education|academic background|projects|personal projects|"
    r"technical skills|skills|core competencies|certifications?|achievements|awards)\s*:?\s*$",
    re.I,
)
SECTION_KEY = {
    "summary": "summary", "professional summary": "summary", "profile": "summary", "objective": "summary",
    "about me": "summary", "experience": "experience", "work experience": "experience",
    "professional experience": "experience", "employment history": "experience", "internship": "experience",
    "internships": "experience", "education": "education", "academic background": "education",
    "projects": "projects", "personal projects": "projects", "skills": "skills", "technical skills": "skills",
    "core competencies": "skills", "certification": "certifications", "certifications": "certifications",
}
DEGREE_RE = re.compile(r"\b(b\.?\s?tech|m\.?\s?tech|b\.?e\b|m\.?e\b|b\.?sc|m\.?sc|bca|mca|mba|bba|b\.?com|ph\.?d|bachelor|master|diploma|class xii|class x|hsc|ssc|12th|10th)", re.I)


def _s(value, limit=300) -> str:
    return str(value or "").strip()[:limit]


def normalise(data: dict) -> dict:
    """Coerce any parser output (LLM or rules) into the CandidateProfile shape."""
    out = {
        "full_name": _s(data.get("full_name"), 150),
        "headline": _s(data.get("headline"), 200),
        "email": _s(data.get("email"), 254) if EMAIL_RE.fullmatch(_s(data.get("email"), 254)) else "",
        "phone": _s(data.get("phone"), 40),
        "location": _s(data.get("location"), 150),
        "summary": _s(data.get("summary"), 2000),
    }
    for key in ("linkedin_url", "github_url", "portfolio_url"):
        url = _s(data.get(key), 300)
        out[key] = ("https://" + url if url and not url.startswith("http") else url) if URL_RE.fullmatch(url or "-") else ""
    try:
        years = float(data.get("total_experience_years"))
        out["total_experience_years"] = round(years, 1) if 0 <= years < 60 else None
    except (TypeError, ValueError):
        out["total_experience_years"] = None
    skills, seen = [], set()
    for sk in data.get("skills") or []:
        name = _s(sk, 60)
        if name and name.lower() not in seen:
            seen.add(name.lower())
            skills.append(name)
    out["skills"] = skills[:LIST_LIMITS["skills"]]
    out["certifications"] = [c for c in (_s(c, 200) for c in data.get("certifications") or []) if c][:LIST_LIMITS["certifications"]]
    for key, fields in ENTRY_FIELDS.items():
        entries = []
        for item in data.get(key) or []:
            if not isinstance(item, dict):
                continue
            entry = {f: _s(item.get(f), 2000 if f == "description" else 200) for f in fields}
            if any(entry.values()):
                entries.append(entry)
        out[key] = entries[:LIST_LIMITS[key]]
    return out


def _parse_with_llm(text: str) -> dict | None:
    if not os.environ.get("OPENROUTER_API_KEY"):
        return None
    try:
        reply = chat_completion(
            [{"role": "user", "content": PROMPT + text[:MAX_PROMPT_CHARS]}], max_tokens=2500, temperature=0
        )
        reply = re.sub(r"^```(?:json)?|```$", "", reply.strip()).strip()
        data = json.loads(reply[reply.find("{"): reply.rfind("}") + 1])
        return data if isinstance(data, dict) else None
    except Exception as exc:  # any LLM problem -> rules fallback
        logger.info("LLM resume parse failed, using rules: %s", exc)
        return None


def _sections(lines: list[str]) -> dict[str, list[str]]:
    sections, current = {"header": []}, "header"
    for line in lines:
        m = SECTION_RE.match(line)
        if m:
            current = SECTION_KEY.get(m.group(1).lower(), "other")
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)
    return sections


def _blocks_by_dates(lines: list[str]) -> list[dict]:
    """Split an experience/education section into entries at lines with a date range."""
    entries, cur = [], None
    for line in lines:
        m = DATE_RANGE_RE.search(line)
        if m:
            head = DATE_RANGE_RE.sub("", line).strip(" |,–-")
            if cur is None or cur["body"]:
                cur = {"head": [], "start": "", "end": "", "body": []}
                entries.append(cur)
            if head:
                cur["head"].append(head)
            cur["start"], cur["end"] = m.group(1).strip(), m.group(2).strip().title()
        elif cur is None:
            cur = {"head": [line], "start": "", "end": "", "body": []}
            entries.append(cur)
        elif not cur["body"] and len(cur["head"]) < 2 and len(line) < 80 and not line.startswith(("•", "-", "*")):
            cur["head"].append(line)
        else:
            cur["body"].append(line.lstrip("•-* "))
    return entries


def parse_with_rules(text: str) -> dict:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    sec = _sections(lines)
    header = sec.get("header", [])
    name = next((ln for ln in header[:5] if 1 < len(ln.split()) <= 4 and re.fullmatch(r"[A-Za-z .'-]+", ln)), "")
    urls = [m.group(0) for m in URL_RE.finditer(text) if "@" not in m.group(0)]
    phone = next((m.group(0).strip() for m in PHONE_RE.finditer(text) if len(re.sub(r"\D", "", m.group(0))) >= 10), "")
    email = EMAIL_RE.search(text)

    experience = []
    for b in _blocks_by_dates(sec.get("experience", [])):
        head = b["head"] + ["", ""]
        experience.append({"title": head[0], "company": head[1], "start": b["start"], "end": b["end"],
                           "description": "\n".join(b["body"])})
    education = []
    for b in _blocks_by_dates(sec.get("education", [])):
        head = b["head"] + ["", ""]
        deg_first = bool(DEGREE_RE.search(head[0]))
        education.append({"degree": head[0] if deg_first else head[1], "institution": head[1] if deg_first else head[0],
                          "start": b["start"], "end": b["end"], "grade": " ".join(b["body"])[:100]})
    projects = []
    for ln in sec.get("projects", []):
        if not ln.startswith(("•", "-", "*")) and len(ln) < 80:
            projects.append({"name": ln, "description": "", "link": ""})
        elif projects:
            projects[-1]["description"] = (projects[-1]["description"] + " " + ln.lstrip("•-* ")).strip()

    years = YEARS_EXP_RE.search(text)
    skills = sorted(skillgraph.extract_skills(text))
    return {
        "full_name": name.title() if name.isupper() else name,
        "headline": experience[0]["title"] if experience else "",
        "email": email.group(0) if email else "",
        "phone": phone,
        "summary": " ".join(sec.get("summary", []))[:1000],
        "linkedin_url": next((u for u in urls if "linkedin.com" in u.lower()), ""),
        "github_url": next((u for u in urls if "github.com" in u.lower()), ""),
        "portfolio_url": next((u for u in urls if not re.search(r"linkedin|github|gmail|mailto", u, re.I)
                               and "/" in u.split("//")[-1]), ""),
        "total_experience_years": float(years.group(1)) if years else None,
        "skills": skills,
        "certifications": [ln.lstrip("•-* ") for ln in sec.get("certifications", [])][:15],
        "experience": experience,
        "education": education,
        "projects": projects,
    }


def parse_resume(text: str) -> tuple[dict, str]:
    """Returns (profile fields, parser) where parser is "ai" or "rules"."""
    data = _parse_with_llm(text)
    if data:
        parsed = normalise(data)
        # The keyword graph catches skills the model left out of its list.
        known = {s.lower() for s in parsed["skills"]}
        parsed["skills"] += [s for s in sorted(skillgraph.extract_skills(text)) if s not in known]
        parsed["skills"] = parsed["skills"][:LIST_LIMITS["skills"]]
        return parsed, "ai"
    return normalise(parse_with_rules(text)), "rules"
