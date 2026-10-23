"""
Deterministic, zero-cost ATS scoring of a resume against a job posting.

The score blends what recruiter ATS filters and screeners actually look at:

  keywords    (60) skills from the posting, weighted by where they appear —
                   "Requirements"/"Must have" > responsibilities > "Nice to
                   have"; "About us"/"Benefits" are ignored. An exact mention
                   earns full credit, a skill only implied by another one
                   (React -> JavaScript) partial credit, since keyword filters
                   match literal words.
  experience  (15) years the posting asks for vs. years worked out from the
                   resume's date ranges (or an explicit "N years of experience").
  title       (10) the posting's role title found in the resume.
  education   (5)  the degree level the posting requires.
  structure   (10) parseability: contact details, standard section headings,
                   quantified impact, sensible length.

A part the posting says nothing about (no years, no degree) is left out and
the rest re-weighted. Each part that falls short adds a suggestion.
"""

import re
from datetime import date

from . import skillgraph

MAX_TEXT_CHARS = 30_000

WEIGHTS = {"keywords": 60, "experience": 15, "title": 10, "education": 5, "structure": 10}
LABELS = {
    "keywords": "Skills & keywords", "experience": "Experience", "title": "Job title",
    "education": "Education", "structure": "Resume structure",
}
IMPLIED_CREDIT = 0.6
IMPORTANCE_WEIGHT = {"required": 3, "general": 2, "preferred": 1}

# ---------------------------------------------------------------------------
# Posting sections
# ---------------------------------------------------------------------------

# Checked in this order; first match wins ("about you" is a requirement, "about acme" is not).
_HEADINGS = [
    ("preferred", r"nice[- ]to[- ]haves?|preferred|bonus(?: points)?(?: if you have)?|good[- ]to[- ]haves?|pluses|"
                  r"desirable|desired(?! profile)|additional (?:skills|qualifications)|extra credit|it'?s a plus|"
                  r"even better if|ways to stand out|you might also have"),
    ("required", r"requirements?|(?:minimum|basic|required|key|essential|candidate|job) (?:qualifications|skills|"
                 r"requirements)|qualifications?|must[- ]haves?|what you(?:'ll| will)? (?:need|bring)(?: to the table)?|"
                 r"(?:the )?experience we need|"
                 r"what (?:we(?:'re| are)|we) look(?:ing)? for|we(?:'re| are) looking for(?: someone)?(?: with)?|who you are|"
                 r"about you|"
                 r"you (?:have|bring|should have|will have|might be a fit)|you(?:'ll| will) (?:have|need)|"
                 r"you should apply if|(?:the |an )?ideal candidate|what skills do i need|"
                 r"what (?:do )?you need to (?:be successful|succeed)|skills(?: required)?(?: & attributes)?|"
                 r"required skills|technical skills|(?:[a-z]+ )*(?:requirements|qualifications)|"
                 r"skill set|your (?:expertise|skills|background|experience)|desired profile|candidate profile|"
                 r"eligibility|experience|required"),
    ("general", r"(?:[a-z]+ )*responsibilities|what you(?:'ll| will)? do|what will (?:i|you) be doing|in this role|"
                r"the role|"
                r"about the (?:role|job|position|opportunity)|(?:an )?overview of (?:the|this) role|"
                r"what'?s the opportunity|the opportunity|your (?:role|impact|day)|"
                r"the (?:impact|difference) you(?: will|'ll)? (?:have|make)|about (?:the )?team & (?:about )?(?:the )?role|"
                r"(?:a )?typical day|day[- ]to[- ]day|job description|role overview|key responsibilities|overview|"
                r"what success looks like|what to expect"),
    ("ignore", r"about (?:us|the company|the team|[a-z0-9.&]+)|who we are|our (?:story|mission|vision|values|culture|"
               r"commitment|benefits)|the values|benefits|perks|total rewards|what we offer|what'?s in it for you|"
               r"why (?:join|work|you should)|why [a-z0-9.]+|compensation|salary|pay range|"
               r"(?:[a-z ]+ )?salary range|hourly rate|annual|zone|equal (?:opportunity|employment)|eeo|diversity|"
               r"inclusion|belonging|accommodations?|life at|how to apply|application process|privacy|policies|"
               r"compliance|location|your location|travel|flexible working|hiring and how|see yourself|"
               r"things we love|how we(?:'ll| will) take care|how [a-z0-9]+ (?:supports|will support)|"
               r"the community|stay alert|fraud|recruitment fraud|unleash your potential|#li"),
]
# Words a heading may carry after its keyword ("Preferred Qualifications", "Requirements & Skills").
# Anything else ("Experience with Python") makes the line content, not a heading.
_HEADING_FILLER = """and qualifications? skills? requirements? experience responsibilities duties expectations profile
    we you you'll need have has offer the role job position us team company what who our your must nice to good
    preferred basic minimum key technical additional plus bonus required desired candidate ideal for this following
    if attributes""".split()
_FILLER = rf"(?:[\s&/,@-]+(?:{'|'.join(_HEADING_FILLER)}))*"
_HEADING_RES = [(kind, re.compile(rf"(?:{pat})(?![a-z])"), re.compile(rf"(?:{pat}){_FILLER}"))
                for kind, pat in _HEADINGS]
_PREFERRED_LINE = re.compile(
    r"\b(?:nice to have|good to have|(?:is |are )?an? (?:big |huge )?(?:plus|advantage|bonus)|preferred|"
    r"preferably|desirable|advantageous|not required|optional|would be great|bonus points?)\b"
)
_REQUIRED_LINE = re.compile(r"\b(?:must|required|mandatory|essential|strong (?:experience|knowledge|proficiency)|"
                            r"proficien\w*|expert(?:ise)?|solid (?:experience|understanding))\b")


def _heading(line: str):
    """(section kind, rest of the line) when `line` opens a section, else None."""
    line = line.replace("\u2019", "'").replace("\u2018", "'")
    head, sep, rest = line.partition(":")
    head = head.lower().strip()
    sep = sep or head.endswith("?")
    head = re.sub(r"^[\s#*\-•>]+(?!li)|[\s*:.?!]+$", "", head)  # keeps "#li-remote" tags whole
    if not head or len(head.split()) > 7:
        return None
    for kind, prefix, full in _HEADING_RES:
        # "Requirements: ..." / "Our commitment to inclusion" may run on; a bare
        # heading must be only its keyword plus filler words.
        loose = sep or (kind == "ignore" and not skillgraph.extract_skills(head))
        if full.fullmatch(head) or (loose and prefix.match(head)):
            return kind, rest.strip()
    return None


def _posting_lines(description: str):
    """Yield (importance, line) for every line, tracking section headings."""
    section = "general"
    for raw in (description or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        line_section = section
        head = _heading(line)
        if head:
            kind, rest = head
            if not rest:
                section = kind
                continue
            line_section = kind  # "Requirements: 3+ years" keeps its heading words as context
            # A bullet or a one-off label ("- Location: Bangalore") doesn't open a new section.
            if not (line.startswith(("-", "•", "*")) or kind == "ignore"):
                section = kind
        if line_section == "ignore":
            yield "ignore", line
            continue
        low = line.lower()
        if _PREFERRED_LINE.search(low):
            yield "preferred", line
        elif line_section == "general" and _REQUIRED_LINE.search(low):
            yield "required", line
        else:
            yield line_section, line


# ---------------------------------------------------------------------------
# Keywords
# ---------------------------------------------------------------------------

_RANK = {"ignore": 0, "preferred": 1, "general": 2, "required": 3}
_OR = re.compile(r"\s*(?:,\s*)?(?:or|and/or)\s*", re.I)


def _line_groups(line: str):
    """Skills in `line`, with "Python or Go" kept together as one either-or requirement."""
    norm, found = skillgraph.locate(line)
    groups = []
    for i, (start, _, skill) in enumerate(found):
        if i and _OR.fullmatch(norm[found[i - 1][1]:start]):
            groups[-1].append(skill)
        else:
            groups.append([skill])
    return [tuple(sorted(set(g))) for g in groups]


# "Work closely with product management, design and sales" names teams, not skills.
_TEAM_SKILLS = {"product management", "project management", "ux design", "ui design", "sales", "marketing",
                "customer success", "accounting", "data engineering", "devops", "sre", "quality assurance"}
_COLLABORATION = re.compile(r"\b(?:work(?:ing|s)? (?:closely |directly |hand in hand )?with|collaborat\w*|"
                            r"partner(?:ing|s)? with|alongside|cross[- ]functional|liais\w*|"
                            r"together with|teams? (?:across|including))\b", re.I)


def _required_skills(job_title, job_description, job_tags, company=""):
    """{skills tuple: (importance, weight)}; a tuple of several skills is an
    either-or requirement. Title/tag skills are always required."""
    best: dict[tuple, str] = {}
    mentions: dict[tuple, int] = {}
    # The employer's own name ("Databricks", "GitLab", "MongoDB") is prose, not a
    # requirement, unless the posting lists it under requirements.
    own = skillgraph.extract_skills(company or "") | {skillgraph.skill_for_tag(company or "")} - {None}
    for importance, line in _posting_lines(job_description):
        teamwork = bool(_COLLABORATION.search(line))
        for key in _line_groups(line):
            if teamwork and all(s in _TEAM_SKILLS for s in key):
                continue
            if importance == "general" and all(s in own for s in key):
                continue
            mentions[key] = mentions.get(key, 0) + 1
            if _RANK[importance] > _RANK.get(best.get(key), -1):
                best[key] = importance
    tags = [str(t) for t in job_tags or []]
    headline = skillgraph.extract_skills(f"{job_title or ''}\n" + "\n".join(tags)) - own
    headline |= {s for s in map(skillgraph.skill_for_tag, tags) if s}
    for skill in headline:
        best[(skill,)] = "required"

    out = {}
    for key, importance in best.items():
        if importance == "ignore":
            continue  # only mentioned in "About us" / "Benefits"
        if len(key) > 1 and any(_RANK.get(best.get((s,)), -1) >= _RANK[importance] for s in key):
            continue  # one option is already asked for on its own, at least as strongly
        in_title = len(key) == 1 and key[0] in headline
        weight = IMPORTANCE_WEIGHT[importance] + (2 if in_title else 0) + (1 if mentions.get(key, 0) >= 3 else 0)
        if all(s in skillgraph.SOFT_SKILLS for s in key):
            weight = 1
        out[key] = (importance, weight)
    return out


def _keyword_part(required, resume_text, extra_have):
    explicit = skillgraph.extract_skills(resume_text) | set(extra_have)
    implied = skillgraph.expand(explicit) - explicit
    keywords, earned, total = [], 0.0, 0
    for key, (importance, weight) in required.items():
        hit = [s for s in key if s in explicit] or [s for s in key if s in implied]
        status = "missing" if not hit else "matched" if hit[0] in explicit else "implied"
        name = hit[0] if hit else " or ".join(key)
        if not hit and " or ".join(key) in explicit:  # Jev confirmed an either-or requirement
            status = "matched"
        earned += weight * {"matched": 1.0, "implied": IMPLIED_CREDIT, "missing": 0.0}[status]
        total += weight
        keywords.append({"skill": name, "label": " or ".join(map(skillgraph.label, [name] if hit else key)),
                         "importance": importance, "status": status, "weight": weight})
    keywords.sort(key=lambda k: (-k["weight"], k["skill"]))
    return (100 * earned / total if total else None), keywords


# ---------------------------------------------------------------------------
# Experience
# ---------------------------------------------------------------------------

_JD_YEARS = re.compile(r"(?<![\d.])(\d{1,2})(?:\.\d)?\s*(?:\+|plus)?\s*(?:(?:-|–|—|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)\b",
                       re.I)
_EXPERIENCE_CONTEXT = re.compile(r"experience|exp\b|working|professional|industry|hands[- ]on|track record", re.I)
_RESUME_YEARS = re.compile(
    r"(?<![\d.])(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+\w+){0,2}?\s+(?:experience|exp\b)", re.I)

_MONTHS = {m: i for i, names in enumerate(
    ["jan january", "feb february", "mar march", "apr april", "may", "jun june", "jul july",
     "aug august", "sep sept september", "oct october", "nov november", "dec december"], 1) for m in names.split()}
_MONTH = r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|" \
         r"oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
_DATE = rf"(?:{_MONTH}\.?,?\s*'?\d{{4}}|\d{{1,2}}\s*/\s*\d{{4}}|\d{{4}})"
_NOW = r"present|current(?:ly)?|now|today|ongoing|date"
_RANGE = re.compile(rf"(?<![\d/])({_DATE})\s*(?:-|–|—|to|till|until)\s*({_DATE}|{_NOW})\b", re.I)


def required_years(description: str):
    """Years of experience the posting asks for (None if it doesn't say)."""
    found = []
    for importance, line in _posting_lines(description):
        if importance in ("ignore", "preferred") or not _EXPERIENCE_CONTEXT.search(line):
            continue
        found += [int(m.group(1)) for m in _JD_YEARS.finditer(line) if 0 < int(m.group(1)) <= 15]
    return max(found) if found else None


def _parse_date(text: str, today: date):
    text = text.strip().lower()
    if re.fullmatch(_NOW, text):
        return today.year * 12 + today.month
    year = int(re.search(r"\d{4}", text).group(0))
    month = re.match(r"(\d{1,2})\s*/", text)
    name = re.match(r"[a-z]+", text)
    if month:
        mon = int(month.group(1))
    elif name:
        mon = _MONTHS.get(name.group(0), 6)
    else:
        mon = 6  # year only: assume mid-year at both ends
    if not 1 <= mon <= 12 or not 1970 <= year <= today.year + 1:
        return None
    return year * 12 + mon


def resume_years(resume_text: str, today: date | None = None):
    """Years of work experience: merged date ranges outside Education, or an
    explicit "N years of experience" claim, whichever is larger."""
    today = today or date.today()
    intervals, prev = [], ""
    for section, line in _resume_lines(resume_text):
        # Degree, project and certificate dates aren't work experience.
        skip = section in ("education", "projects", "other") or _EDUCATION_LINE.search(line) \
            or (len(line) < 30 and _EDUCATION_LINE.search(prev))
        prev = line
        if skip:
            continue
        for m in _RANGE.finditer(line):
            start, end = _parse_date(m.group(1), today), _parse_date(m.group(2), today)
            if start and end and 0 <= end - start <= 40 * 12:
                intervals.append((start, end))
    months, cur = 0, None
    for start, end in sorted(intervals):
        if cur and start <= cur[1]:
            cur = (cur[0], max(cur[1], end))
        else:
            if cur:
                months += cur[1] - cur[0]
            cur = (start, end)
    if cur:
        months += cur[1] - cur[0]
    claimed = [float(m.group(1)) for m in _RESUME_YEARS.finditer(resume_text or "") if float(m.group(1)) <= 40]
    years = max([months / 12] + claimed) if (intervals or claimed) else None
    return None if years is None else round(years, 1)


def _experience_part(need, have):
    if need is None:
        return None
    if have is None:
        return 40.0  # no dates to verify against
    if have >= need:
        return 100.0
    return max(0.0, 100 * have / need - 10)


# ---------------------------------------------------------------------------
# Resume sections, title, education, structure
# ---------------------------------------------------------------------------

_RESUME_HEADINGS = {
    "experience": r"(?:work |professional |relevant )?experience|employment(?: history)?|work history|"
                  r"internships?|career history",
    "education": r"education(?:al)?(?: background| qualifications?| details)?|academics?|academic (?:background|details)|"
                 r"qualifications?",
    "skills": r"(?:technical |key |core )?skills|core competencies|competencies|tech(?:nical)? stack|technologies|"
              r"tools(?: & technologies)?",
    "projects": r"(?:academic |personal |key )?projects",
    "summary": r"summary|profile|professional summary|objective|career objective|about me",
    "other": r"certifications?|achievements|awards|publications|languages|interests|hobbies|"
             r"extra[- ]curricular(?: activities)?|positions of responsibility|volunteering",
}
_RESUME_HEADING_RE = {k: re.compile(rf"^(?:{p})$") for k, p in _RESUME_HEADINGS.items()}
_EDUCATION_LINE = re.compile(r"\b(?:university|college|institute of|school|b\.?\s?tech|m\.?\s?tech|bachelor|master'?s|"
                             r"b\.?\s?sc|m\.?\s?sc|cgpa|gpa|class (?:x|xii|10|12)|hsc|ssc|cbse|icse)\b", re.I)


def _resume_heading(line: str):
    head = re.sub(r"^[\s#*\-•>|]+|[\s*:|_\-=]+$", "", line.lower())
    head = re.sub(r"\s*&\s*", " & ", head)
    if not head or len(head) > 40:
        return None
    for kind, regex in _RESUME_HEADING_RE.items():
        if regex.match(head):
            return kind
    return None


def _resume_lines(resume_text: str):
    section = ""
    for raw in (resume_text or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        kind = _resume_heading(line)
        if kind:
            section = kind
            continue
        yield section, line


_LEVEL_WORDS = {"senior", "sr", "junior", "jr", "lead", "early", "career", "experienced", "principal", "staff", "intern", "internship", "associate",
                "trainee", "fresher", "entry", "level", "mid", "i", "ii", "iii", "iv", "head", "chief", "graduate",
                "new", "grad", "the", "and", "of", "for", "a", "an", "in", "at", "to", "with", "remote", "hybrid",
                "onsite", "contract", "full", "time", "part", "f", "m", "x"}
_TITLE_SYNONYMS = {"developer": "engineer", "programmer": "engineer", "sde": "engineer", "swe": "engineer",
                   "dev": "engineer", "engineering": "engineer", "back-end": "backend", "front-end": "frontend",
                   "full-stack": "fullstack", "fullstack": "fullstack", "analytics": "analyst", "scientist": "science",
                   "designer": "design", "marketer": "marketing", "management": "manager"}
_WORD = re.compile(r"[a-z0-9+#]+(?:-[a-z0-9+#]+)*")


def _title_words(text: str) -> list[str]:
    text = re.sub(r"\b(back|front|full)\s+(end|stack)\b", r"\1-\2", (text or "").lower())
    words = []
    for w in _WORD.findall(text):
        parts = [w] if w in _TITLE_SYNONYMS or "-" not in w else w.split("-")  # "sde-2" -> sde, 2
        words += [_TITLE_SYNONYMS.get(p, p) for p in parts]
    return words


def _title_parts(job_title: str) -> list[str]:
    """"2027 - Software Engineer Intern, Dublin" -> ["2027", "Software Engineer Intern", "Dublin"]"""
    return [p.strip() for p in re.split(r"\s[-–—|/]\s|[()\[\],:]", job_title or "") if p.strip()]


def _core_title(job_title: str) -> list[str]:
    for part in _title_parts(job_title):
        core = [w for w in dict.fromkeys(_title_words(part)) if w not in _LEVEL_WORDS and not w.isdigit()]
        if core:
            return core
    return []


def _title_part(job_title, resume_text):
    core = _core_title(job_title)
    if not core:
        return None, core
    words = _title_words(resume_text)
    joined = " " + " ".join(words) + " "
    if f" {' '.join(core)} " in joined:
        return 100.0, core
    have = set(words)
    return 100 * sum(w in have for w in core) / len(core) * 0.9, core


_DEGREES = [
    (3, r"ph\.?\s?d|doctorate|doctoral"),
    (2, r"master'?s|masters|m\.?\s?tech|m\.e\.|m\.?\s?sc|m\.s\.|(?-i:MS|ME)(?=\s*(?:\(|in |degree))|mca|mba|"
        r"pgdm|post[- ]?graduat\w*"),
    (1, r"bachelor'?s?|bachelors|b\.?\s?tech|b\.e\.|(?-i:BE|BS)(?=\s*(?:\(|in |degree))|b\.?\s?sc|b\.s\.|bca|bba|"
        r"b\.?\s?com|undergraduate degree|(?:university|college|engineering|4[- ]year) degree|degree in"),
]
_DEGREE_RES = [(lvl, re.compile(rf"(?<![a-z]){pat}(?![a-z])", re.I)) for lvl, pat in _DEGREES]
DEGREE_NAMES = {1: "bachelor's degree", 2: "master's degree", 3: "PhD"}


def _degree_levels(text: str) -> set[int]:
    return {lvl for lvl, regex in _DEGREE_RES if regex.search(text)}


def required_degree(description: str):
    """(level, equivalent_ok) the posting requires, or (None, False)."""
    need, equivalent = None, False
    for importance, line in _posting_lines(description):
        if importance in ("ignore", "preferred"):
            continue
        levels = _degree_levels(line)
        if levels and (need is None or min(levels) > need):
            need, equivalent = min(levels), bool(re.search(r"equivalent|or (?:relevant )?experience", line, re.I))
    return need, equivalent


def _education_part(need, equivalent, resume_text, experience_ok):
    if need is None:
        return None, None
    have = max(_degree_levels(resume_text), default=0)
    if have >= need:
        score = 100.0
    elif equivalent and experience_ok:
        score = 80.0
    elif have:
        score = 50.0
    else:
        score = 0.0
    return score, have


_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PHONE = re.compile(r"(?<!\d)\+?\(?\d[\d\s().-]{7,16}\d(?!\d)")
_METRIC = re.compile(r"\d+(?:\.\d+)?\s*(?:%|percent|x\b|k\b|m\b|cr\b|crore|lakh|lpa|users|customers|clients|"
                     r"requests|ms\b|seconds|hours|days|people|engineers|members|projects|\+)|[₹$€£]\s?\d", re.I)


def _structure_part(resume_text):
    sections = {s for s, _ in _resume_lines(resume_text)}
    words = len(re.findall(r"\w+", resume_text or ""))
    metrics = len(_METRIC.findall(resume_text or ""))
    checks = {
        "email": bool(_EMAIL.search(resume_text or "")),
        "phone": any(10 <= len(re.sub(r"\D", "", m.group(0))) <= 13 for m in _PHONE.finditer(resume_text or "")),
        "experience_section": bool(sections & {"experience", "projects"}),
        "education_section": "education" in sections,
        "skills_section": "skills" in sections,
        "metrics": 1.0 if metrics >= 3 else 0.5 if metrics else 0.0,
        "length": 1.0 if 250 <= words <= 1200 else 0.5 if 120 <= words <= 1800 else 0.0,
    }
    score = 100 * sum(float(v) for v in checks.values()) / len(checks)
    return score, checks, words


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def ats_check(resume_text: str, job_title: str, job_description: str, job_tags=None, extra_have=(),
              company: str = "", today: date | None = None) -> dict:
    resume_text = (resume_text or "")[:MAX_TEXT_CHARS]
    job_description = (job_description or "")[:MAX_TEXT_CHARS]

    required = _required_skills(job_title, job_description, job_tags, company)
    keyword_score, keywords = _keyword_part(required, resume_text, extra_have)
    if keyword_score is None:  # nothing recognisable in the posting to score against
        return {"ats_score": None, "matched_keywords": [], "missing_keywords": []}

    need_years, have_years = required_years(job_description), resume_years(resume_text, today)
    experience_score = _experience_part(need_years, have_years)
    title_score, core_title = _title_part(job_title, resume_text)
    need_degree, equivalent = required_degree(job_description)
    education_score, have_degree = _education_part(
        need_degree, equivalent, resume_text, experience_ok=bool(experience_score and experience_score >= 100))
    structure_score, checks, words = _structure_part(resume_text)

    parts = {"keywords": keyword_score, "experience": experience_score, "title": title_score,
             "education": education_score, "structure": structure_score}
    scored = {k: v for k, v in parts.items() if v is not None}
    total_weight = sum(WEIGHTS[k] for k in scored)
    overall = round(sum(WEIGHTS[k] * v for k, v in scored.items()) / total_weight)
    shares = {k: round(100 * WEIGHTS[k] / total_weight) for k in scored}
    shares["keywords"] += 100 - sum(shares.values())  # rounding remainder
    breakdown = [{"key": k, "label": LABELS[k], "score": round(v), "weight": shares[k]} for k, v in scored.items()]

    matched = sorted({k["skill"] for k in keywords if k["status"] != "missing"})
    missing = list(dict.fromkeys(k["skill"] for k in keywords if k["status"] == "missing"))  # most important first
    implied = sorted({k["skill"] for k in keywords if k["status"] == "implied"})
    return {
        "ats_score": max(0, min(100, overall)),
        "matched_keywords": matched,
        "missing_keywords": missing,
        "implied_keywords": implied,
        "keywords": _display_rows(keywords),
        "breakdown": breakdown,
        "experience": {"required_years": need_years, "resume_years": have_years},
        "suggestions": _suggestions(keywords, need_years, have_years, title_score, core_title, job_title,
                                    need_degree, have_degree, education_score, checks, words),
    }


def _display_rows(keywords):
    """One row per skill, its most important requirement (scoring counts them all)."""
    seen, rows = set(), []
    for kw in keywords:
        if kw["skill"] not in seen:
            seen.add(kw["skill"])
            rows.append({k: v for k, v in kw.items() if k != "weight"})
    return rows


def _suggestions(keywords, need_years, have_years, title_score, core_title, job_title,
                 need_degree, have_degree, education_score, checks, words):
    tips = []
    missing_req = [k["label"] for k in keywords if k["status"] == "missing" and k["importance"] == "required"]
    missing_other = [k["label"] for k in keywords if k["status"] == "missing" and k["importance"] != "required"]
    implied = list(dict.fromkeys(k["label"] for k in keywords if k["status"] == "implied"))
    if missing_req:
        one = len(missing_req) == 1
        tips.append(f"The posting requires {_list(missing_req[:6])}, which your resume doesn't mention. "
                    f"{'If you have used it, add it' if one else 'Add the ones you have used'} to your skills and "
                    f"to the bullet where you used {'it' if one else 'them'}.")
    elif missing_other:
        tips.append(f"Also mentioned in the posting: {_list(missing_other[:6])}. Add any you've worked with.")
    if implied:
        tips.append(f"Spell out {_list(implied[:6])} — your resume implies {'it' if len(implied) == 1 else 'them'} "
                    f"(e.g. through a related framework), but ATS filters match the exact words.")
    if need_years is not None:
        if have_years is None:
            tips.append(f"The role asks for {need_years}+ years of experience. Add start and end dates to each role "
                        f"(e.g. \"Jan 2022 – Present\") so the ATS can count yours.")
        elif have_years < need_years:
            tips.append(f"The role asks for {need_years}+ years; we count about {have_years:g} on your resume. "
                        f"Include internships and freelance work with dates if you have them.")
    if title_score is not None and title_score < 100 and core_title:
        tips.append(f"Use the job title \"{_short_title(job_title)}\" in your headline or summary if it honestly "
                    f"describes your work — recruiters search by title.")
    if need_degree and education_score is not None and education_score < 100:
        if have_degree:
            tips.append(f"The posting asks for a {DEGREE_NAMES[need_degree]}; list your degree in full in Education.")
        else:
            tips.append(f"The posting asks for a {DEGREE_NAMES[need_degree]}. Add an Education section with your "
                        f"degree, institute and graduation year — ATS filters often screen on it.")
    if not checks["email"] or not checks["phone"]:
        tips.append("Put your email and phone number as plain text at the top — not in a header, footer or image.")
    absent = [name for key, name in (("experience_section", "Experience"), ("education_section", "Education"),
                                     ("skills_section", "Skills")) if not checks[key]]
    if absent:
        tips.append(f"Use standard section headings ATS parsers recognise: {_list(absent)}.")
    if checks["metrics"] < 1:
        tips.append("Quantify your impact — numbers like \"cut load time 40%\" or \"served 10k users\" rank higher "
                    "with recruiters.")
    if checks["length"] < 1:
        tips.append("Your resume looks very short; aim for 300–900 words covering your roles, projects and skills."
                    if words < 250 else "Your resume is long; trim it to the most relevant 1–2 pages.")
    return tips


def _list(items):
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def _short_title(job_title):
    return next((p for p in _title_parts(job_title) if _core_title(p)), job_title)
