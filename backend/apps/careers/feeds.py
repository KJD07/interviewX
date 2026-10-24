"""
Live jobs, from two kinds of free, keyless sources (no API cost):

  * company boards — ~1000 companies' public careers boards on Greenhouse,
    Lever, Ashby, SmartRecruiters, and (mostly Indian companies) Keka, Workday
    and Freshteam (JobBoard rows, seeded from data/job_boards.json; Indian
    companies are found by `manage.py discover_job_boards`). These are the
    companies' own postings, so a role disappears here as soon as the company
    closes it.
  * aggregator feeds — Remotive and Arbeitnow (remote / EU roles).

A full sweep runs at most once per JOB_REFRESH_HOURS (5h). This stack has no
cron/Celery, so the first request that finds the feed stale claims the sweep
and runs it on a background thread (HTTP fetches fan out over a small thread
pool; DB writes stay on the sweep thread). `manage.py refresh_jobs` runs the
same sweep from a shell or an external scheduler.
"""

import html
import json
import logging
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone as dt_tz
from pathlib import Path

import httpx
from django.conf import settings
from django.db import close_old_connections, transaction
from django.utils import timezone

from . import skillgraph
from .models import Job, JobBoard, JobFeedState

logger = logging.getLogger(__name__)

REMOTIVE_URL = "https://remotive.com/api/remote-jobs?limit=100"
ARBEITNOW_URL = "https://www.arbeitnow.com/api/job-board-api"
GREENHOUSE_JOBS = "https://boards-api.greenhouse.io/v1/boards/{token}/jobs"
GREENHOUSE_JOB = "https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}"
LEVER_JOBS = "https://api.lever.co/v0/postings/{token}?mode=json"
ASHBY_JOBS = "https://api.ashbyhq.com/posting-api/job-board/{token}"
# country=in: the platform serves Indian candidates, and big SmartRecruiters
# employers (Bosch, ServiceNow…) list thousands of roles worldwide.
SMARTRECRUITERS_JOBS = "https://api.smartrecruiters.com/v1/companies/{token}/postings?country=in&limit=100&offset={offset}"
SMARTRECRUITERS_JOB = "https://api.smartrecruiters.com/v1/companies/{token}/postings/{id}"
KEKA_CAREERS = "https://{token}.keka.com/careers/"
KEKA_JOBS = "https://{token}.keka.com/careers/api/embedjobs/default/active/{org}"
KEKA_JOB_URL = "https://{token}.keka.com/careers/jobdetails/{id}"
KEKA_ORG_INFO = "https://{token}.keka.com/careers/api/organization/default/careerportalinfo"
_KEKA_ORG_RE = re.compile(r"/ats/documents/([0-9a-f-]{36})/")
FRESHTEAM_JOBS = "https://{token}.freshteam.com/hire/widgets/jobs.json"
# Workday token: "<tenant>/<wdN>/<site>", e.g. "nvidia/wd5/NVIDIAExternalCareerSite".
WORKDAY_HOST = "https://{tenant}.{wd}.myworkdayjobs.com"
WORKDAY_PAGE = 20  # Workday's max page size
_WORKDAY_POSTED_RE = re.compile(r"(\d+)\+?\s+days?", re.I)
BOARDS_FILE = Path(__file__).resolve().parent / "data" / "job_boards.json"

TIMEOUT = 15
LEVER_TIMEOUT = 45
# Jobs posted more than settings.JOB_MAX_AGE_DAYS ago are dropped at ingest and
# deleted every sweep; otherwise board jobs live until the company closes them.
MAX_PER_BOARD = 200       # newest N per company keeps one mega-board from flooding the list
MAX_DESCRIPTION = 8000
DEACTIVATE_AFTER = 5      # consecutive failed sweeps before a board is switched off
_TAG_RE = re.compile(r"<[^>]+>")
# Plain alternation (no \b) so the same patterns work in Postgres regex too —
# migration 0003 froze a copy to backfill in_india.
INDIA_LOCATION_PATTERN = (
    r"india|bengaluru|bangalore|hyderabad|mumbai|pune|gurgaon|gurugram|noida|delhi|chennai|kolkata"
    r"|ahmedabad|jaipur|kochi|cochin|coimbatore|indore|chandigarh|thiruvananthapuram|trivandrum|mysore"
    r"|mysuru|vadodara|nagpur|bhubaneswar|lucknow|visakhapatnam"
)
OPEN_REMOTE_PATTERN = r"anywhere|worldwide|global|apac|asia"
_INDIA_RE = re.compile(INDIA_LOCATION_PATTERN, re.I)
_OPEN_REMOTE_RE = re.compile(OPEN_REMOTE_PATTERN, re.I)
# Sources whose list payload has no description; it's fetched on first open.
LAZY_DESCRIPTION_SOURCES = ("greenhouse", "smartrecruiters", "workday")


_BLOCK_BREAK_RE = re.compile(r"</(?:p|div|h[1-6]|ul|ol|tr|section)\s*>|<br\s*/?>", re.I)
_LI_RE = re.compile(r"<li\b[^>]*>", re.I)


def _clean_description(text: str) -> str:
    """Strip HTML to text, keeping one line per paragraph and "- " list bullets
    so the jobs page can render the posting's structure instead of one wall of text."""
    text = _LI_RE.sub("\n- ", _BLOCK_BREAK_RE.sub("\n", text or ""))
    text = html.unescape(_TAG_RE.sub(" ", text))
    lines = (re.sub(r"\s+", " ", line).strip() for line in text.split("\n"))
    return "\n".join(line for line in lines if line and line != "-")


def _html_lines(plain: str) -> str:
    """Plain-text fields carry real newlines; turn them into <br> so
    _clean_description keeps them alongside the HTML parts it's joined with."""
    return html.escape(plain or "").replace("\n", "<br>")


def _parse_dt(value) -> datetime:
    if isinstance(value, (int, float)):
        # Lever sends epoch milliseconds.
        return datetime.fromtimestamp(value / 1000 if value > 10**11 else value, tz=dt_tz.utc)
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=dt_tz.utc)
    except ValueError:
        return timezone.now()


# ---------------------------------------------------------------------------
# Classification (work mode, seniority) — plain keyword rules, zero cost
# ---------------------------------------------------------------------------

_ENTRY_RE = re.compile(r"\b(intern|internship|junior|jr|graduate|new grad|entry[- ]level|fresher|trainee|apprentice|associate engineer|campus)\b")
_SENIOR_RE = re.compile(r"\b(senior|sr|staff|principal|lead|head|director|vp|vice president|chief|architect|distinguished)\b")
_YEARS_RE = re.compile(r"(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2}\s*)?\+?\s*years?")


def infer_level(title: str, description: str = "") -> str:
    t = title.lower()
    if _ENTRY_RE.search(t):
        return Job.Level.ENTRY
    if _SENIOR_RE.search(t):
        return Job.Level.SENIOR
    m = _YEARS_RE.search(description.lower()[:4000])
    if m:
        years = int(m.group(1))
        if years <= 1:
            return Job.Level.ENTRY
        return Job.Level.SENIOR if years >= 5 else Job.Level.MID
    return Job.Level.MID  # no seniority marker in the title: the common case is mid-level


def infer_work_mode(explicit: str = "", *texts: str) -> str:
    e = (explicit or "").lower().replace("-", "").replace("_", "")
    if "remote" in e:
        return Job.WorkMode.REMOTE
    if "hybrid" in e:
        return Job.WorkMode.HYBRID
    if "onsite" in e or "office" in e:
        return Job.WorkMode.ONSITE
    blob = " ".join(texts).lower()
    if "hybrid" in blob:
        return Job.WorkMode.HYBRID
    if "remote" in blob or "anywhere" in blob:
        return Job.WorkMode.REMOTE
    return Job.WorkMode.ONSITE if blob.strip() else ""


def is_india_job(location: str, work_mode: str) -> bool:
    """In India, or remote and open to India (anywhere / APAC / Asia)."""
    return bool(_INDIA_RE.search(location or "")) or (
        work_mode == Job.WorkMode.REMOTE and bool(_OPEN_REMOTE_RE.search(location or "")))


def job_skills(title: str, tags, description: str) -> list[str]:
    return sorted(skillgraph.extract_skills(f"{title}\n{' '.join(tags or [])}\n{description[:MAX_DESCRIPTION]}"))


def _row(**kw) -> dict:
    kw["title"] = (kw["title"] or "").strip()[:300]
    kw["company"] = (kw.get("company") or "")[:200]
    kw["location"] = (kw.get("location") or "")[:200]
    kw["description"] = (kw.get("description") or "")[:MAX_DESCRIPTION]
    kw["tags"] = [str(t)[:60] for t in (kw.get("tags") or []) if t][:20]
    kw.setdefault("work_mode", infer_work_mode("", kw["location"], kw["title"]))
    kw["level"] = infer_level(kw["title"], kw["description"])
    kw["in_india"] = is_india_job(kw["location"], kw["work_mode"])
    return kw


# ---------------------------------------------------------------------------
# Aggregator feeds
# ---------------------------------------------------------------------------

def fetch_remotive() -> list[dict]:
    data = httpx.get(REMOTIVE_URL, timeout=TIMEOUT).raise_for_status().json()
    return [
        _row(source="remotive", external_id=str(j["id"]), title=j["title"], company=j.get("company_name"),
             location=j.get("candidate_required_location"), url=j["url"],
             description=_clean_description(j.get("description", "")), tags=list(j.get("tags") or []),
             work_mode=Job.WorkMode.REMOTE, posted_at=_parse_dt(j.get("publication_date")))
        for j in data.get("jobs", [])
    ]


def fetch_arbeitnow() -> list[dict]:
    data = httpx.get(ARBEITNOW_URL, timeout=TIMEOUT).raise_for_status().json()
    return [
        _row(source="arbeitnow", external_id=j["slug"], title=j["title"], company=j.get("company_name"),
             location=j.get("location"), url=j["url"], description=_clean_description(j.get("description", "")),
             tags=list(j.get("tags") or []),
             work_mode=Job.WorkMode.REMOTE if j.get("remote") else infer_work_mode("", j.get("location", "")),
             posted_at=_parse_dt(j.get("created_at")))
        for j in data.get("data", [])
    ]


FETCHERS = (fetch_remotive, fetch_arbeitnow)


# ---------------------------------------------------------------------------
# Company boards
# ---------------------------------------------------------------------------

def _fetch_greenhouse(board: JobBoard, client: httpx.Client) -> list[dict]:
    # The list endpoint without ?content=true is ~20x smaller; descriptions are
    # fetched lazily per job (ensure_description) when a candidate opens one.
    data = client.get(GREENHOUSE_JOBS.format(token=board.token)).raise_for_status().json()
    return [
        _row(source="greenhouse", external_id=f"{board.token}:{j['id']}", title=j.get("title"),
             company=j.get("company_name") or board.company, location=(j.get("location") or {}).get("name"),
             url=j.get("absolute_url"), posted_at=_parse_dt(j.get("first_published") or j.get("updated_at")))
        for j in data.get("jobs", []) if j.get("absolute_url")
    ]


def _fetch_lever(board: JobBoard, client: httpx.Client) -> list[dict]:
    # Lever returns every posting with full descriptions in one payload — slow for big boards.
    data = client.get(LEVER_JOBS.format(token=board.token), timeout=LEVER_TIMEOUT).raise_for_status().json()
    if not isinstance(data, list):
        raise ValueError("unexpected Lever payload")
    rows = []
    for j in data:
        cats = j.get("categories") or {}
        lists = "\n".join(f"{li.get('text', '')}\n{li.get('content', '')}" for li in j.get("lists") or [])
        rows.append(_row(
            source="lever", external_id=f"{board.token}:{j['id']}", title=j.get("text"), company=board.company,
            location=cats.get("location"), url=j.get("hostedUrl"),
            description=_clean_description(
                f"{_html_lines(j.get('descriptionPlain', ''))}\n{lists}\n{_html_lines(j.get('additionalPlain', ''))}"),
            tags=[cats.get("team"), cats.get("commitment")],
            work_mode=infer_work_mode(j.get("workplaceType", ""), cats.get("location", ""), j.get("text", "")),
            posted_at=_parse_dt(j.get("createdAt")),
        ))
    return rows


def _fetch_ashby(board: JobBoard, client: httpx.Client) -> list[dict]:
    data = client.get(ASHBY_JOBS.format(token=board.token)).raise_for_status().json()
    return [
        _row(source="ashby", external_id=f"{board.token}:{j['id']}", title=j.get("title"), company=board.company,
             location=j.get("location"), url=j.get("jobUrl"), description=_clean_description(
                 j.get("descriptionHtml") or _html_lines(j.get("descriptionPlain", ""))),
             tags=[j.get("department"), j.get("team"), j.get("employmentType")],
             work_mode=Job.WorkMode.REMOTE if j.get("isRemote") and not j.get("workplaceType")
             else infer_work_mode(j.get("workplaceType", ""), j.get("location", ""), j.get("title", "")),
             posted_at=_parse_dt(j.get("publishedAt")))
        for j in data.get("jobs", []) if j.get("isListed", True) and j.get("jobUrl")
    ]


def _fetch_smartrecruiters(board: JobBoard, client: httpx.Client) -> list[dict]:
    # Paged at 100; descriptions are fetched lazily per job (ensure_description).
    postings = []
    for offset in range(0, MAX_PER_BOARD, 100):
        data = client.get(SMARTRECRUITERS_JOBS.format(token=board.token, offset=offset)).raise_for_status().json()
        page = data.get("content") or []
        postings += page
        if len(postings) >= (data.get("totalFound") or 0) or len(page) < 100:
            break
    rows = []
    for j in postings:
        loc = j.get("location") or {}
        city = loc.get("city") or ""
        location = ", ".join(p for p in (city, "India" if loc.get("country") == "in" else "") if p)
        work_mode = (Job.WorkMode.REMOTE if loc.get("remote") else Job.WorkMode.HYBRID if loc.get("hybrid")
                     else infer_work_mode("", location, j.get("name", "")))
        rows.append(_row(
            source="smartrecruiters", external_id=f"{board.token}:{j['id']}", title=j.get("name"),
            company=board.company, location=location,
            url=f"https://jobs.smartrecruiters.com/{(j.get('company') or {}).get('identifier') or board.token}/{j['id']}",
            tags=[(j.get(k) or {}).get("label") for k in ("department", "function", "typeOfEmployment")],
            work_mode=work_mode, posted_at=_parse_dt(j.get("releasedDate")),
        ))
    return rows


def _india_location(cities, country_code: str) -> str:
    cities = list(dict.fromkeys(c for c in cities if c))
    place = ", ".join(cities[:4]) + (" +more" if len(cities) > 4 else "")
    return ", ".join(p for p in (place, "India" if country_code.upper() == "IN" else "") if p)


def _fetch_keka(board: JobBoard, client: httpx.Client) -> list[dict]:
    # The jobs API is keyed by the org's GUID, which only appears on the careers page.
    page = client.get(KEKA_CAREERS.format(token=board.token)).raise_for_status().text
    org = _KEKA_ORG_RE.search(page)
    if not org:
        raise ValueError("Keka org id not found on careers page")
    data = client.get(KEKA_JOBS.format(token=board.token, org=org.group(1))).raise_for_status().json()
    if not isinstance(data, list):
        raise ValueError("unexpected Keka payload")
    rows = []
    for j in data:
        locs = j.get("jobLocations") or []
        location = _india_location([loc.get("city") for loc in locs],
                                   "IN" if any(loc.get("countryCode") == "IN" for loc in locs) else "")
        rows.append(_row(
            source="keka", external_id=f"{board.token}:{j['id']}", title=j.get("title"), company=board.company,
            location=location, url=KEKA_JOB_URL.format(token=board.token, id=j["id"]),
            description=_clean_description(j.get("description") or ""),
            tags=[j.get("departmentName"), j.get("experience")], posted_at=_parse_dt(j.get("publishedOn")),
        ))
    return rows


def _fetch_freshteam(board: JobBoard, client: httpx.Client) -> list[dict]:
    data = client.get(FRESHTEAM_JOBS.format(token=board.token)).raise_for_status().json()
    branches = {b["id"]: b for b in data.get("branches") or []}
    roles = {r["id"]: r.get("name") for r in data.get("job_roles") or []}
    rows = []
    for j in data.get("jobs") or []:
        # New accounts come with a placeholder posting.
        if j.get("deleted") or not j.get("url") or (j.get("title") or "").strip().lower() == "sample job posting":
            continue
        branch = branches.get(j.get("branch_id")) or {}
        location = _india_location([branch.get("city")], branch.get("country_code") or "")
        rows.append(_row(
            source="freshteam", external_id=f"{board.token}:{j['id']}", title=j.get("title"), company=board.company,
            location=location, url=j["url"], description=_clean_description(j.get("description") or ""),
            tags=[roles.get(j.get("job_role_id"))],
            work_mode=Job.WorkMode.REMOTE if j.get("remote") else infer_work_mode("", location, j.get("title", "")),
            posted_at=_parse_dt(j.get("created_at")),
        ))
    return rows


_INDIA_WORD_RE = re.compile(rf"\b(?:{INDIA_LOCATION_PATTERN})\b", re.I)  # "Indianapolis" is not India


def _workday_india_facet(facets) -> tuple[str, list[str]] | None:
    """(facetParameter, ids) selecting this tenant's India roles: its "India" country value
    wherever it's nested, else every location value naming an Indian city."""
    cities = None

    def walk(fs):
        nonlocal cities
        for facet in fs or []:
            values = facet.get("values") or []
            for value in values:
                if "values" in value:  # a facet group, e.g. locationMainGroup -> locationHierarchy1
                    found = walk([value])
                    if found:
                        return found
                elif (value.get("descriptor") or "").strip().lower() == "india":
                    return facet["facetParameter"], [value["id"]]
            ids = [v["id"] for v in values if "values" not in v and _INDIA_WORD_RE.search(v.get("descriptor") or "")]
            if ids and cities is None and "location" in (facet.get("facetParameter") or "").lower():
                cities = (facet["facetParameter"], ids)
        return None

    return walk(facets) or cities


def _workday_posted(text: str) -> datetime:
    # Only relative dates in the list ("Posted Today", "Posted 3 Days Ago", "Posted 30+ Days Ago").
    text = (text or "").lower()
    days = 0 if "today" in text else 1 if "yesterday" in text else None
    if days is None:
        m = _WORKDAY_POSTED_RE.search(text)
        days = int(m.group(1)) if m else 30
    return timezone.now() - timedelta(days=days)


def _fetch_workday(board: JobBoard, client: httpx.Client) -> list[dict]:
    # Big multinational tenants: only their India roles (the tenant's own India
    # location facet). Descriptions are fetched lazily per job (ensure_description).
    tenant, wd, site = board.token.split("/")
    host = WORKDAY_HOST.format(tenant=tenant, wd=wd)
    api = f"{host}/wday/cxs/{tenant}/{site}/jobs"

    def page(offset: int, facets: dict) -> dict:
        body = {"appliedFacets": facets, "limit": WORKDAY_PAGE, "offset": offset, "searchText": ""}
        return client.post(api, json=body).raise_for_status().json()

    first = page(0, {})
    india = _workday_india_facet(first.get("facets"))
    facets = {india[0]: india[1]} if india else {}
    data = page(0, facets) if india else first
    total, postings = data.get("total") or 0, list(data.get("jobPostings") or [])
    while len(postings) < min(total, MAX_PER_BOARD) and data.get("jobPostings"):
        data = page(len(postings), facets)
        postings += data.get("jobPostings") or []
    rows = []
    for j in postings:
        path = j.get("externalPath")
        if not path:
            continue
        location = j.get("locationsText") or ""
        if india and not _INDIA_RE.search(location):
            location = f"India ({location})" if location else "India"
        rows.append(_row(
            source="workday", external_id=f"{tenant}:{path.rsplit('/', 1)[-1][-120:]}", title=j.get("title"),
            company=board.company, location=location, url=f"{host}/{site}{path}",
            posted_at=_workday_posted(j.get("postedOn")),
        ))
    return rows


BOARD_FETCHERS = {
    JobBoard.ATS.GREENHOUSE: _fetch_greenhouse,
    JobBoard.ATS.LEVER: _fetch_lever,
    JobBoard.ATS.ASHBY: _fetch_ashby,
    JobBoard.ATS.SMARTRECRUITERS: _fetch_smartrecruiters,
    JobBoard.ATS.KEKA: _fetch_keka,
    JobBoard.ATS.WORKDAY: _fetch_workday,
    JobBoard.ATS.FRESHTEAM: _fetch_freshteam,
}


def fetch_board(board: JobBoard, client: httpx.Client) -> list[dict]:
    # Paged APIs (Workday) can repeat a posting across pages; one row per id
    # keeps the bulk upsert from touching the same row twice.
    rows = list({r["external_id"]: r for r in BOARD_FETCHERS[board.ats](board, client)}.values())
    rows.sort(key=lambda r: r["posted_at"], reverse=True)
    return rows[:MAX_PER_BOARD]


def sync_boards_from_file() -> int:
    """Insert any board in data/job_boards.json that isn't in the DB yet.
    Never re-activates or edits existing rows, so admin changes stick."""
    try:
        entries = json.loads(BOARDS_FILE.read_text())
    except (OSError, ValueError) as exc:
        logger.warning("job boards file unreadable: %s", exc)
        return 0
    before = JobBoard.objects.count()
    JobBoard.objects.bulk_create(
        [JobBoard(ats=e["ats"], token=e["token"], company=e["company"][:200]) for e in entries],
        ignore_conflicts=True,
    )
    return JobBoard.objects.count() - before


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

UPDATE_FIELDS = ["title", "company", "location", "url", "tags", "work_mode", "in_india", "posted_at", "fetched_at",
                 "board"]


def _max_age_cutoff():
    return timezone.now() - timedelta(days=settings.JOB_MAX_AGE_DAYS)


def _upsert(rows: list[dict], board: JobBoard | None = None) -> set[str]:
    """Bulk upsert rows of one source; returns every external_id seen.
    Only new or changed rows are written (most of a re-sweep is unchanged), and
    skills are only re-extracted for new or retitled rows. Postings older than
    JOB_MAX_AGE_DAYS are skipped (and so left out of the returned ids)."""
    cutoff = _max_age_cutoff()
    rows = list({r["external_id"]: r for r in rows if r["posted_at"] >= cutoff}.values())  # one per id for ON CONFLICT
    if not rows:
        return set()
    source = rows[0]["source"]
    ids = [r["external_id"] for r in rows]
    # Lazy-description rows carry none in the list payload, so don't wipe the
    # description and what was derived from it once filled in.
    fields = UPDATE_FIELDS + ([] if source in LAZY_DESCRIPTION_SOURCES else ["description", "skills", "level"])
    compared = [f for f in fields if f not in ("fetched_at", "board", "skills")]
    known = {eid: (board_id, skills, dict(zip(compared, vals))) for eid, board_id, skills, *vals in
             Job.objects.filter(source=source, external_id__in=ids)
             .values_list("external_id", "board_id", "skills", *compared)}
    board_id = board.pk if board else None
    now = timezone.now()
    objs = []
    for r in rows:
        old_board, skills, old = known.get(r["external_id"], (None, None, None))
        if old is not None and old_board == board_id and all(old[f] == r[f] for f in compared):
            continue
        if old is None or old["title"] != r["title"]:  # skill extraction is the costly step
            skills = job_skills(r["title"], r["tags"], r["description"])
        objs.append(Job(board=board, skills=skills, fetched_at=now, **r))
    if objs:
        Job.objects.bulk_create(objs, update_conflicts=True, unique_fields=["source", "external_id"],
                                update_fields=fields)
    return set(ids)


def _save_board_result(board: JobBoard, rows: list[dict] | None, error: str = "") -> None:
    board.last_fetched_at = timezone.now()
    if rows is None:
        board.consecutive_failures += 1
        board.last_error = error[:200]
        if board.consecutive_failures >= DEACTIVATE_AFTER:
            board.is_active = False
        board.save(update_fields=["last_fetched_at", "consecutive_failures", "last_error", "is_active"])
        return
    seen = _upsert(rows, board)
    # Roles the company has closed drop out of its board -> remove them here.
    Job.objects.filter(board=board).exclude(external_id__in=seen).delete()
    board.consecutive_failures = 0
    board.last_error = ""
    board.last_job_count = len(rows)
    board.save(update_fields=["last_fetched_at", "consecutive_failures", "last_error", "last_job_count"])


def refresh_boards(boards=None) -> tuple[int, int]:
    """Fetch every active board concurrently. Returns (ok, failed)."""
    if boards is None:
        sync_boards_from_file()
        boards = list(JobBoard.objects.filter(is_active=True))
    ok = failed = 0
    headers = {"User-Agent": "EvaluLabs-Jobs/1.0 (+https://evalulabs.dev)"}
    with httpx.Client(timeout=TIMEOUT, headers=headers, follow_redirects=True) as client:
        # Second pass retries this sweep's failures at low concurrency (timeouts under load are common).
        pending, workers = list(boards), max(1, settings.JOB_FETCH_CONCURRENCY)
        for last_pass in (False, True):
            retry = []
            with ThreadPoolExecutor(max_workers=workers) as pool:
                futures = {pool.submit(fetch_board, b, client): b for b in pending}
                for fut in as_completed(futures):
                    board = futures[fut]
                    try:
                        rows = fut.result()
                    except Exception as exc:  # network/shape errors on one board never stop the sweep
                        if not last_pass:
                            retry.append(board)
                            continue
                        _save_board_result(board, None, f"{type(exc).__name__}: {exc}")
                        failed += 1
                        continue
                    try:
                        _save_board_result(board, rows)
                        ok += 1
                    except Exception:
                        logger.exception("saving board %s failed", board)
                        failed += 1
            pending, workers = retry, 4
            if not pending:
                break
    return ok, failed


def refresh_jobs() -> tuple[int, list[str]]:
    """Pull every aggregator feed (one failing feed doesn't block the others). Returns jobs upserted."""
    count, errors = 0, []
    for fetch in FETCHERS:
        try:
            rows = fetch()
        except Exception as exc:  # network/shape errors must never break the request
            logger.warning("job feed %s failed: %s", fetch.__name__, exc)
            errors.append(f"{fetch.__name__}: {exc}"[:100])
            continue
        count += len(_upsert(rows))
    return count, errors


def run_sweep() -> None:
    """One full refresh: aggregator feeds + every company board, then stats."""
    _, errors = refresh_jobs()
    ok, failed = refresh_boards()
    Job.objects.filter(posted_at__lt=_max_age_cutoff()).delete()
    india = Job.objects.filter(in_india=True)
    JobFeedState.objects.update_or_create(pk=1, defaults={
        "last_finished_at": timezone.now(),
        "last_error": "; ".join(errors)[:300],
        "boards_ok": ok,
        "boards_failed": failed,
        "jobs_count": Job.objects.count(),
        "companies_count": Job.objects.values("company").distinct().count(),
        "india_jobs_count": india.count(),
        "india_companies_count": india.values("company").distinct().count(),
    })


def _run_sweep_in_thread() -> None:
    try:
        run_sweep()
    except Exception:
        logger.exception("job sweep failed")
    finally:
        close_old_connections()


# A sweep takes minutes; one still "running" after this died with its process.
STUCK_SWEEP = timedelta(hours=1)


def claim_sweep(interval: timedelta) -> bool:
    """Stamp a new sweep start if the last one started >= interval ago (or died
    mid-run). The row lock lets exactly one caller claim it."""
    with transaction.atomic():
        state, _ = JobFeedState.objects.select_for_update().get_or_create(pk=1)
        since = timezone.now() - state.last_refreshed_at if state.last_refreshed_at else None
        if since is not None and since < interval and not (is_sweeping(state) and since >= STUCK_SWEEP):
            return False
        # Stamp before fetching: a failing feed is retried next interval, not on every request.
        state.last_refreshed_at = timezone.now()
        state.save(update_fields=["last_refreshed_at"])
    return True


def refresh_if_stale() -> bool:
    """Request-path fallback. With the job_sweeper service running
    (JOB_SWEEPER_EXTERNAL) it owns the schedule and requests only step in once
    the feed is twice as stale, i.e. the sweeper is down. The sweep runs
    off-request (inline when JOB_REFRESH_SYNC, e.g. tests)."""
    hours = settings.JOB_REFRESH_HOURS * (2 if settings.JOB_SWEEPER_EXTERNAL else 1)
    if not claim_sweep(timedelta(hours=hours)):
        return False
    if settings.JOB_REFRESH_SYNC:
        run_sweep()
    else:
        threading.Thread(target=_run_sweep_in_thread, name="job-sweep", daemon=True).start()
    return True


def is_sweeping(state: JobFeedState | None) -> bool:
    if not state or not state.last_refreshed_at:
        return False
    return not state.last_finished_at or state.last_finished_at < state.last_refreshed_at


def _fetch_description_html(job: Job) -> str:
    token, _, post_id = job.external_id.partition(":")
    if job.source == "workday":
        # https://<tenant>.<wdN>.myworkdayjobs.com/<site>/job/... -> .../wday/cxs/<tenant>/<site>/job/...
        host, _, path = job.url.partition(".myworkdayjobs.com/")
        api = f"{host}.myworkdayjobs.com/wday/cxs/{token}/{path}"
        data = httpx.get(api, timeout=TIMEOUT).raise_for_status().json()
        return (data.get("jobPostingInfo") or {}).get("jobDescription") or ""
    if job.source == "greenhouse":
        data = httpx.get(GREENHOUSE_JOB.format(token=token, id=post_id), timeout=TIMEOUT).raise_for_status().json()
        return html.unescape(data.get("content") or "")
    data = httpx.get(SMARTRECRUITERS_JOB.format(token=token, id=post_id), timeout=TIMEOUT).raise_for_status().json()
    sections = ((data.get("jobAd") or {}).get("sections") or {}).values()
    return "".join(f"<h3>{s.get('title') or ''}</h3>{s.get('text') or ''}" for s in sections if s.get("text"))


def ensure_description(job: Job) -> Job:
    """Greenhouse/SmartRecruiters/Workday list payloads carry no description; fetch it on first open."""
    if job.description or job.source not in LAZY_DESCRIPTION_SOURCES or not job.board_id:
        return job
    try:
        content = _fetch_description_html(job)
    except Exception as exc:
        logger.info("%s description fetch failed for %s: %s", job.source, job.pk, exc)
        return job
    job.description = _clean_description(content)[:MAX_DESCRIPTION]
    job.skills = job_skills(job.title, job.tags, job.description)
    job.level = infer_level(job.title, job.description) or job.level
    job.save(update_fields=["description", "skills", "level"])
    return job
