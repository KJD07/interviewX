"""
Finds the public job boards of Indian companies and startups, so their roles
show up in Live jobs next to the ~1,000 boards in data/job_boards.json.

Input is data/india_companies.json — [{"company", "careers_url"?, "slugs"?,
"india_only"?}] — or a spreadsheet (.xlsx) with a "Company" column (see
load_companies). Companies that already have a board in job_boards.json are
skipped. For each of the rest we

  1. read its careers page — the given careers_url, or else <name>.com/.ai/.io
     (/.in for India-only lists) + "/careers" — plus a few same-site
     "jobs"/"openings" links, and pick out links to an ATS we can fetch:
     Greenhouse, Lever, Ashby, SmartRecruiters, Keka, Workday, Freshteam;
  2. guess board slugs from the company name ("Urban Company" -> urbancompany,
     urban-company) on the ATSs whose boards are addressed by slug alone;
  3. verify every candidate by running the real board fetcher (feeds.fetch_board).
     India-only entries (the default) keep a board only if it has India roles —
     boards linked from a careers page need at least one, guessed slugs need
     India to be at least half of the board, so a same-named foreign company
     isn't picked up. Other entries (e.g. US startups, shown under Live jobs'
     "Worldwide") only need the board to have open roles.

Verified boards are merged into data/job_boards.json, which every sweep reads
(feeds.sync_boards_from_file). Run with `manage.py discover_job_boards`.

Not covered: Darwinbox (popular with Indian companies, but its careers API
sits behind a Cloudflare bot check) and TurboHire / Zoho Recruit (no public
jobs API). Companies on those stay out until they're added by hand.
"""

import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx

from . import feeds
from .models import JobBoard

logger = logging.getLogger(__name__)

COMPANIES_FILE = Path(__file__).resolve().parent / "data" / "india_companies.json"
TIMEOUT = 15
MAX_FOLLOW_LINKS = 3
PROBE_MIN_INDIA_SHARE = 0.5
USER_AGENT = "Mozilla/5.0 (compatible; EvaluLabs-Jobs/1.0; +https://evalulabs.dev)"

# (ats, pattern) — group 1 (and 2, 3 for Workday) build the board token.
DETECTORS = [
    (JobBoard.ATS.GREENHOUSE, re.compile(
        r"(?:boards|job-boards)\.greenhouse\.io/(?:embed/job_board(?:/js)?\?for=)?([a-z0-9_-]+)", re.I)),
    (JobBoard.ATS.GREENHOUSE, re.compile(r"boards-api\.greenhouse\.io/v1/boards/([a-z0-9_-]+)", re.I)),
    (JobBoard.ATS.LEVER, re.compile(r"jobs\.lever\.co/([a-z0-9_.-]+)", re.I)),
    (JobBoard.ATS.ASHBY, re.compile(r"jobs\.ashbyhq\.com/([a-z0-9_.%-]+)", re.I)),
    (JobBoard.ATS.SMARTRECRUITERS, re.compile(r"(?:careers|jobs)\.smartrecruiters\.com/([a-z0-9_-]+)", re.I)),
    (JobBoard.ATS.KEKA, re.compile(r"([a-z0-9-]+)\.keka\.com/careers", re.I)),
    (JobBoard.ATS.FRESHTEAM, re.compile(r"([a-z0-9-]+)\.freshteam\.com", re.I)),
    (JobBoard.ATS.WORKDAY, re.compile(
        r"([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com/(?:[a-z]{2}-[A-Z]{2}/)?([a-z0-9_-]+)", re.I)),
]
# Path segments the patterns above can capture that aren't board tokens.
NOT_TOKENS = {"embed", "v1", "api", "static", "assets", "cdn", "js", "css", "www", "jobs", "wday", "job", "widgets", "hire"}
# ATSs whose board is addressed by a slug alone, so a name guess can be probed.
PROBE_ATS = (JobBoard.ATS.GREENHOUSE, JobBoard.ATS.LEVER, JobBoard.ATS.ASHBY,
             JobBoard.ATS.KEKA, JobBoard.ATS.FRESHTEAM)
_JOB_LINK_RE = re.compile(r"""href=["']([^"'#]+)["']""", re.I)
_JOB_LINK_WORDS = re.compile(r"job|career|opening|position|vacanc|join|hiring", re.I)


@dataclass
class Candidate:
    ats: str
    token: str
    via: str  # "page" (linked from a careers page) or "probe" (guessed from the company name)


@dataclass
class Result:
    company: str
    found: list[dict] = field(default_factory=list)   # verified boards: {ats, token, company, jobs, india_jobs}
    notes: list[str] = field(default_factory=list)
    skipped: bool = False  # company already had a board in job_boards.json


def detect_boards(html: str) -> list[tuple[str, str]]:
    """(ats, token) pairs for every fetchable ATS board linked from a page."""
    found = []
    for ats, pattern in DETECTORS:
        for m in pattern.finditer(html):
            if ats == JobBoard.ATS.WORKDAY:
                tenant, wd, site = (g.lower() if i < 2 else g for i, g in enumerate(m.groups()))
                if site.lower() in NOT_TOKENS:
                    continue
                token = f"{tenant}/{wd}/{site}"
            else:
                token = m.group(1).strip(".")
                if token.lower() in NOT_TOKENS or len(token) < 2:
                    continue
                if ats != JobBoard.ATS.SMARTRECRUITERS:
                    token = token.lower()
            if (ats, token) not in found:
                found.append((ats, token))
    return found


def slug_guesses(company: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", company.lower().replace("&", " and "))
    words = [w for w in words if w not in {"pvt", "private", "ltd", "limited", "inc", "technologies", "india"}] or words
    guesses = ["".join(words), "-".join(words)]
    return list(dict.fromkeys(g for g in guesses if len(g) >= 3))


def _job_links(html: str, base: str) -> list[str]:
    host = urlparse(base).netloc
    links = []
    for href in _JOB_LINK_RE.findall(html):
        url = urljoin(base, href)
        if urlparse(url).netloc == host and _JOB_LINK_WORDS.search(urlparse(url).path) and url != base:
            links.append(url)
    return list(dict.fromkeys(links))[:MAX_FOLLOW_LINKS]


def _page_candidates(careers_url: str, client: httpx.Client, notes: list[str]) -> list[Candidate]:
    try:
        resp = client.get(careers_url)
    except Exception as exc:
        notes.append(f"careers page unreachable ({type(exc).__name__})")
        return []
    # Scanned whatever the status: some single-page sites serve their careers
    # page as a 404. A 403 is usually a bot wall — slug guessing still runs.
    if resp.status_code >= 400:
        notes.append(f"careers page returned {resp.status_code}")
    pairs = detect_boards(resp.text)
    if not pairs:  # many careers pages link out to a separate "open roles" page
        for url in _job_links(resp.text, str(resp.url)):
            try:
                pairs += detect_boards(client.get(url).text)
            except Exception:
                continue
    return [Candidate(ats, token, "page") for ats, token in dict.fromkeys(pairs)]


def careers_url_guesses(company: str, india_only: bool = True) -> list[str]:
    slug = slug_guesses(company)[:1]
    tlds = ("com", "ai", "io", "in") if india_only else ("com", "ai", "io")
    return [f"https://{slug[0]}.{tld}/careers" for tld in tlds] if slug else []


def _name_key(company: str) -> str:
    return "".join(slug_guesses(company)[:1]) or company.lower()


def verify(candidate: Candidate, company: str, client: httpx.Client, india_only: bool = True) -> dict | None:
    """Fetch the board for real and apply the module docstring's India rules."""
    try:
        rows = feeds.fetch_board(JobBoard(ats=candidate.ats, token=candidate.token, company=company), client)
    except Exception:
        return None
    india = sum(1 for r in rows if r["in_india"])
    if not rows or (india_only and not india):
        return None
    if india_only and candidate.via == "probe" and india < PROBE_MIN_INDIA_SHARE * len(rows):
        return None
    return {"ats": str(candidate.ats), "token": candidate.token, "company": company,
            "jobs": len(rows), "india_jobs": india, "via": candidate.via}


def discover_company(entry: dict, client: httpx.Client, known: set[tuple[str, str]], probe: bool = True) -> Result:
    company = entry["company"].strip()
    india_only = entry.get("india_only", True)
    result = Result(company)
    candidates: list[Candidate] = []
    if entry.get("careers_url"):
        candidates += _page_candidates(entry["careers_url"], client, result.notes)
    else:
        for url in careers_url_guesses(company, india_only):
            found = _page_candidates(url, client, [])
            candidates += found
            if found:
                break
    if probe:
        slugs = list(dict.fromkeys([*(entry.get("slugs") or []), *slug_guesses(company)]))
        candidates += [Candidate(ats, slug, "probe") for slug in slugs for ats in PROBE_ATS]
    seen = set()
    for cand in candidates:
        key = (str(cand.ats), cand.token.lower())
        if key in seen:
            continue
        seen.add(key)
        if key in known:
            result.notes.append(f"already listed: {cand.ats}/{cand.token}")
            continue
        board = verify(cand, company, client, india_only)
        if board:
            result.found.append(board)
    return result


def load_companies(path: Path = COMPANIES_FILE) -> list[dict]:
    """A JSON list as above, or an .xlsx: every sheet with a "Company" header row
    is read; a "careers" column is used when it holds a real careers URL (not a
    search-engine link), and sheets whose name doesn't mention India are read as
    india_only=False."""
    if path.suffix.lower() != ".xlsx":
        return json.loads(path.read_text())
    import openpyxl

    entries = []
    for ws in openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets:
        rows = ws.iter_rows(values_only=True)
        header = next((r for r in rows if r and any(str(c).strip().lower() == "company" for c in r if c)), None)
        if not header:
            continue
        cols = [str(c or "").strip().lower() for c in header]
        name_col = cols.index("company")
        url_col = next((i for i, c in enumerate(cols) if "career" in c), None)
        india_only = "india" in ws.title.lower()
        for row in rows:
            name = str(row[name_col] or "").strip() if len(row) > name_col else ""
            if not name:
                continue
            entry = {"company": name, "india_only": india_only}
            url = str(row[url_col] or "").strip() if url_col is not None and len(row) > url_col else ""
            if url.startswith("http") and not re.search(r"google\.|bing\.|duckduckgo\.", url):
                entry["careers_url"] = url
            entries.append(entry)
    return entries


def known_boards() -> set[tuple[str, str]]:
    return {(e["ats"], e["token"].lower()) for e in json.loads(feeds.BOARDS_FILE.read_text())}


def known_companies() -> set[str]:
    return {_name_key(e["company"]) for e in json.loads(feeds.BOARDS_FILE.read_text())}


def add_to_boards_file(boards: list[dict]) -> int:
    """Insert new boards into data/job_boards.json at their alphabetical spot; returns how many were added."""
    entries = json.loads(feeds.BOARDS_FILE.read_text())
    have = {(e["ats"], e["token"].lower()) for e in entries}
    added = 0
    for b in boards:
        if (b["ats"], b["token"].lower()) in have:
            continue
        entry = {"ats": b["ats"], "token": b["token"], "company": b["company"]}
        at = next((i for i, e in enumerate(entries) if e["company"].lower() > entry["company"].lower()), len(entries))
        entries.insert(at, entry)
        have.add((b["ats"], b["token"].lower()))
        added += 1
    if added:
        lines = ",\n".join(json.dumps(e, ensure_ascii=False) for e in entries)
        feeds.BOARDS_FILE.write_text(f"[\n{lines}\n]\n")
    return added


def discover(companies: list[dict], probe: bool = True, workers: int = 8, on_result=None) -> list[Result]:
    """on_result(result), if given, is called as each company finishes (progress output)."""
    known, listed = known_boards(), known_companies()
    todo, results = [], {}
    for i, entry in enumerate(companies):
        if _name_key(entry["company"]) in listed:
            results[i] = Result(entry["company"].strip(), notes=["company already has a board"], skipped=True)
        else:
            todo.append((i, entry))
    headers = {"User-Agent": USER_AGENT}
    with httpx.Client(timeout=TIMEOUT, headers=headers, follow_redirects=True) as client:
        with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
            futures = {pool.submit(discover_company, e, client, known, probe): i for i, e in todo}
            for fut in as_completed(futures):
                results[futures[fut]] = fut.result()
                if on_result:
                    on_result(fut.result())
    return [results[i] for i in range(len(companies))]
