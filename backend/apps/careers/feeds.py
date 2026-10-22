"""
Live jobs, from two kinds of free, keyless sources (no API cost):

  * company boards — ~1000 companies' public careers boards on Greenhouse,
    Lever and Ashby (JobBoard rows, seeded from data/job_boards.json). These
    are the companies' own postings, so a role disappears here as soon as the
    company closes it.
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
BOARDS_FILE = Path(__file__).resolve().parent / "data" / "job_boards.json"

TIMEOUT = 15
LEVER_TIMEOUT = 45
KEEP_DAYS = 30            # aggregator jobs only; board jobs live until the company closes them
MAX_PER_BOARD = 200       # newest N per company keeps one mega-board from flooding the list
MAX_DESCRIPTION = 8000
DEACTIVATE_AFTER = 5      # consecutive failed sweeps before a board is switched off
_TAG_RE = re.compile(r"<[^>]+>")


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(_TAG_RE.sub(" ", text or ""))).strip()


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
    return kw


# ---------------------------------------------------------------------------
# Aggregator feeds
# ---------------------------------------------------------------------------

def fetch_remotive() -> list[dict]:
    data = httpx.get(REMOTIVE_URL, timeout=TIMEOUT).raise_for_status().json()
    return [
        _row(source="remotive", external_id=str(j["id"]), title=j["title"], company=j.get("company_name"),
             location=j.get("candidate_required_location"), url=j["url"],
             description=_clean(j.get("description", "")), tags=list(j.get("tags") or []),
             work_mode=Job.WorkMode.REMOTE, posted_at=_parse_dt(j.get("publication_date")))
        for j in data.get("jobs", [])
    ]


def fetch_arbeitnow() -> list[dict]:
    data = httpx.get(ARBEITNOW_URL, timeout=TIMEOUT).raise_for_status().json()
    return [
        _row(source="arbeitnow", external_id=j["slug"], title=j["title"], company=j.get("company_name"),
             location=j.get("location"), url=j["url"], description=_clean(j.get("description", "")),
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
        lists = " ".join(f"{li.get('text', '')}: {_clean(li.get('content', ''))}" for li in j.get("lists") or [])
        rows.append(_row(
            source="lever", external_id=f"{board.token}:{j['id']}", title=j.get("text"), company=board.company,
            location=cats.get("location"), url=j.get("hostedUrl"),
            description=_clean(f"{j.get('descriptionPlain', '')} {lists} {j.get('additionalPlain', '')}"),
            tags=[cats.get("team"), cats.get("commitment")],
            work_mode=infer_work_mode(j.get("workplaceType", ""), cats.get("location", ""), j.get("text", "")),
            posted_at=_parse_dt(j.get("createdAt")),
        ))
    return rows


def _fetch_ashby(board: JobBoard, client: httpx.Client) -> list[dict]:
    data = client.get(ASHBY_JOBS.format(token=board.token)).raise_for_status().json()
    return [
        _row(source="ashby", external_id=f"{board.token}:{j['id']}", title=j.get("title"), company=board.company,
             location=j.get("location"), url=j.get("jobUrl"), description=_clean(j.get("descriptionPlain", "")),
             tags=[j.get("department"), j.get("team"), j.get("employmentType")],
             work_mode=Job.WorkMode.REMOTE if j.get("isRemote") and not j.get("workplaceType")
             else infer_work_mode(j.get("workplaceType", ""), j.get("location", ""), j.get("title", "")),
             posted_at=_parse_dt(j.get("publishedAt")))
        for j in data.get("jobs", []) if j.get("isListed", True) and j.get("jobUrl")
    ]


BOARD_FETCHERS = {
    JobBoard.ATS.GREENHOUSE: _fetch_greenhouse,
    JobBoard.ATS.LEVER: _fetch_lever,
    JobBoard.ATS.ASHBY: _fetch_ashby,
}


def fetch_board(board: JobBoard, client: httpx.Client) -> list[dict]:
    rows = BOARD_FETCHERS[board.ats](board, client)
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

UPDATE_FIELDS = ["title", "company", "location", "url", "tags", "work_mode", "posted_at", "fetched_at", "board"]


def _upsert(rows: list[dict], board: JobBoard | None = None) -> set[str]:
    """Bulk upsert rows of one source. Skills are only extracted for new or
    retitled rows, so re-sweeps of unchanged jobs stay cheap."""
    rows = list({r["external_id"]: r for r in rows}.values())  # one row per id, or ON CONFLICT errors
    if not rows:
        return set()
    source = rows[0]["source"]
    ids = [r["external_id"] for r in rows]
    known = {eid: (title, skills) for eid, title, skills in
             Job.objects.filter(source=source, external_id__in=ids).values_list("external_id", "title", "skills")}
    now = timezone.now()
    objs = []
    for r in rows:
        title, skills = known.get(r["external_id"], (None, None))
        if title != r["title"]:  # new or retitled posting (skill extraction is the costly step)
            skills = job_skills(r["title"], r["tags"], r["description"])
        objs.append(Job(board=board, skills=skills, fetched_at=now, **r))
    # Greenhouse rows carry no description (fetched lazily), so don't wipe the
    # description and what was derived from it once filled in.
    fields = UPDATE_FIELDS + ([] if source == "greenhouse" else ["description", "skills", "level"])
    Job.objects.bulk_create(objs, update_conflicts=True, unique_fields=["source", "external_id"], update_fields=fields)
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
    Job.objects.filter(board__isnull=True, posted_at__lt=timezone.now() - timedelta(days=KEEP_DAYS)).delete()
    return count, errors


def run_sweep() -> None:
    """One full refresh: aggregator feeds + every company board, then stats."""
    _, errors = refresh_jobs()
    ok, failed = refresh_boards()
    JobFeedState.objects.update_or_create(pk=1, defaults={
        "last_finished_at": timezone.now(),
        "last_error": "; ".join(errors)[:300],
        "boards_ok": ok,
        "boards_failed": failed,
        "jobs_count": Job.objects.count(),
        "companies_count": Job.objects.values("company").distinct().count(),
    })


def _run_sweep_in_thread() -> None:
    try:
        run_sweep()
    except Exception:
        logger.exception("job sweep failed")
    finally:
        close_old_connections()


def refresh_if_stale() -> bool:
    """Start a sweep if the last one started >= JOB_REFRESH_HOURS ago. The row
    lock lets exactly one request claim it; the sweep itself runs off-request
    (inline when JOB_REFRESH_SYNC, e.g. tests)."""
    interval = timedelta(hours=settings.JOB_REFRESH_HOURS)
    with transaction.atomic():
        state, _ = JobFeedState.objects.select_for_update().get_or_create(pk=1)
        if state.last_refreshed_at and timezone.now() - state.last_refreshed_at < interval:
            return False
        # Stamp before fetching: a failing feed is retried next interval, not on every request.
        state.last_refreshed_at = timezone.now()
        state.save(update_fields=["last_refreshed_at"])
    if settings.JOB_REFRESH_SYNC:
        run_sweep()
    else:
        threading.Thread(target=_run_sweep_in_thread, name="job-sweep", daemon=True).start()
    return True


def is_sweeping(state: JobFeedState | None) -> bool:
    if not state or not state.last_refreshed_at:
        return False
    return not state.last_finished_at or state.last_finished_at < state.last_refreshed_at


def ensure_description(job: Job) -> Job:
    """Greenhouse list payloads carry no description; fetch it on first open."""
    if job.description or job.source != "greenhouse" or not job.board_id:
        return job
    token, _, gh_id = job.external_id.partition(":")
    try:
        data = httpx.get(GREENHOUSE_JOB.format(token=token, id=gh_id), timeout=TIMEOUT).raise_for_status().json()
    except Exception as exc:
        logger.info("greenhouse description fetch failed for %s: %s", job.pk, exc)
        return job
    job.description = _clean(html.unescape(data.get("content") or ""))[:MAX_DESCRIPTION]
    job.skills = job_skills(job.title, job.tags, job.description)
    job.level = infer_level(job.title, job.description) or job.level
    job.save(update_fields=["description", "skills", "level"])
    return job
