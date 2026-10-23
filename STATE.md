# STATE.md
## Current phase
Past the original phase plan. Phase 7 (subscriptions + Razorpay) is done,
plus a basic version of Phase 8 (voice) and a lot of features that weren't
in the original spec at all (see "Since Phase 6" below). Work is now
tracked as GitHub issues on the repo rather than one phase per chat.

## Done

### Phase 0 ✅
- Repo structure matches Section 3 of spec exactly
- `docker-compose.yml` wiring Postgres 15 → Django backend → Next.js frontend
  (Postgres has a healthcheck; backend waits for it to be healthy before starting)
- Django 5.0.6 + DRF 3.15.2 project boots cleanly (manage.py check: 0 issues)
  - All four app stubs registered in INSTALLED_APPS: accounts, companies,
    interviews, subscriptions
  - JWT (simplejwt) + CORS (django-cors-headers) configured in settings, not
    wired to URLs yet
  - Root `/` returns JSON health check; `/admin/` exists
  - `core/openrouter_client.py` placeholder exists at the correct path
- Next.js 14.2.35 + TypeScript + Tailwind 3.x builds cleanly (npm run build: 0 errors)
  - `src/lib/api.ts` and `src/lib/auth.ts` placeholders exist, not implemented yet
- `.env.example` committed; `.env` gitignored

### Phase 1 ✅
- `AUTH_USER_MODEL = "accounts.User"` added to `backend/config/settings.py`
- `apps/accounts/models.py` — custom `User(AbstractUser)` with fields:
  `subscription_plan`, `interviews_this_month`, `subscription_end_date`
- `apps/companies/models.py` — `Company`, `Role`, `Round`, `InterviewQuestion`
- `apps/interviews/models.py` — `InterviewSession` with transcript/scores as JSONField
- `apps/subscriptions/models.py` — placeholder
- All admin files created with inline nesting
- Migrations generated and committed

### Phase 2 ✅
- `apps/accounts/serializers.py` — RegisterSerializer, LoginSerializer
- `apps/accounts/views.py` — RegisterView (POST → 201 + tokens), LoginView
- `apps/accounts/urls.py` — /api/auth/register/, /api/auth/login/
- `backend/config/urls.py` — auth URLs + simplejwt TokenRefreshView at
  /api/auth/token/refresh/

### Phase 3 ✅
- `apps/companies/serializers.py` — flat list + nested detail serializers
- `apps/companies/views.py` — CompanyListView, CompanyDetailView, RoleListView,
  RoundListView, RoundDetailView; all IsAuthenticated; prefetch_related throughout
- `apps/companies/urls.py` — /api/companies/, /api/companies/<id>/,
  /api/companies/<id>/roles/, /api/companies/<id>/roles/<id>/rounds/,
  /api/companies/<id>/roles/<id>/rounds/<id>/

### Phase 4 ✅
- `apps/interviews/serializers.py` — InterviewSessionSerializer +
  InterviewSessionListSerializer
- `apps/interviews/views.py` — InterviewSessionListCreateView,
  InterviewSessionDetailView; scoped to request.user
- `apps/interviews/urls.py` — /api/interviews/, /api/interviews/<id>/

### Phase 5 ✅
NOTE: Phase 5 was fully built before STATE.md was updated. All three AI engine
endpoints exist and are wired. STATE.md was incorrectly saying "not started."

- `core/openrouter_client.py` — `build_interview_system_prompt`,
  `build_feedback_prompt`, `chat_completion` (httpx, GPT-4o-mini via OpenRouter)
- `apps/interviews/views.py` — `StartInterviewView` (POST /api/interviews/start/),
  `ChatView` (POST /api/interviews/<id>/chat/),
  `EndInterviewView` (POST /api/interviews/<id>/end/)
- `apps/interviews/models.py` — `feedback` TextField added, `ended_at` field
- `apps/interviews/urls.py` — all three AI engine routes wired
- Plan limit enforcement: free users capped at 2 interviews/month
- Feedback scoring: communication, technical, problem_solving, overall (0–10)

### Phase 6 ✅
Files changed (all in `frontend/src/`):

- `lib/api.ts` — Full fetch wrapper with:
  - JWT Bearer header injection
  - Auto-refresh on 401 (with concurrent-request queue to prevent token
    race conditions)
  - `ApiError` class (status + detail + optional code)
  - Typed endpoints: `auth.register`, `auth.login`, `companies.list`,
    `companies.detail`, `interviews.list`, `interviews.detail`,
    `interviews.start`, `interviews.chat`, `interviews.end`
  - `tokens` object for localStorage access/refresh storage (SSR-safe)

- `lib/auth.ts` — Re-exports `tokens` and types from api.ts (keeps old
  import path alive)

- `context/AuthContext.tsx` — React context providing `user`, `loading`,
  `login`, `register`, `logout`; user snapshot persisted to `ix_user` in
  localStorage for instant hydration on reload

- `hooks/useAuth.ts` — Re-export of `useAuth` for ergonomic imports

- `components/ProtectedRoute.tsx` — Client component that redirects to /login
  if unauthenticated; shows "LOADING" spinner during hydration

- `app/globals.css` — Design tokens (CSS vars), Inter font, `cursor-blink`
  keyframe (the signature element), `fade-up` animation

- `app/layout.tsx` — Wraps app in `<AuthProvider>`

- `app/page.tsx` — Redirects to /dashboard or /login depending on auth state

- `app/login/page.tsx` — Login form (email + password), error display,
  link to /register

- `app/register/page.tsx` — Register form (email + username + password +
  confirm), field-level error for password mismatch

- `app/dashboard/page.tsx` — Protected; shows session history table (status
  badge, per-skill scores, date), plan badge + monthly usage, empty state,
  "Start interview" CTA → /companies

### Since Phase 6 (not tracked phase-by-phase anymore)
A lot landed after Phase 6 without STATE.md being kept in sync — this
section is a catch-up, not a phase-by-phase log like the ones above.

**Phase 7, as originally planned:**
- Free/Pro/Premium/Max subscription tiers with different monthly interview
  limits (`apps/subscriptions/plans.py`)
- Razorpay checkout for paid plans (`/upgrade` page, `create-order` +
  `verify-payment` endpoints)

**Beyond the original spec:**
- Google Sign-In + email OTP verification before an account can log in
  (spec said JWT only, no OAuth — this was a deliberate deviation)
- 4 plan tiers instead of the spec's 2 (free/premium)
- Mid-month interview top-up packs (Spark/Boost/Power) — buy extra
  interviews with Razorpay without upgrading your plan; credits roll over
- Skill-based interviews (Premium/Max only) — practice a single skill
  (React, SQL, Docker, etc.) instead of a full company loop, via `/skills`
  and `seed_skills`
- Voice — Web Speech API speech-to-text/text-to-speech during interviews
  (this is the spec's Phase 8, in early form). The two halves are separate
  switches: the interviewer **always speaks its turns out loud** (on by
  default, silenced only by the header's AI-voice mute or a browser with no
  `speechSynthesis`), while "Answer by voice" is opt-in and only controls
  the candidate's mic. Typing an answer still gets a spoken reply.
- Full-screen "focus mode" during interviews — auto-ends the interview if
  the candidate exits full screen or switches tabs
- Progress/analytics page (`/progress`) with score history charts
- AI question sourcing — admin-triggered pipeline that researches and
  extracts real candidate-reported questions from the web
  (`core/question_sourcing.py`)
- Optional real-interview-report form after a session ends (paid plans) —
  candidates can report a real interview they gave elsewhere
- Marketing site: landing page, About, Careers pages, full visual redesign

**Closed via GitHub issues:**
- #7 — free/paid users who ran out of interviews had no working way to buy
  more (the button was just a link to the full upgrade page, and one banner
  had no button at all). Added a working "buy more interviews" flow to the
  dashboard and companies page, and fixed the limit check to actually
  account for purchased top-up credits.
- #8 — companies and skills selection pages had no search or pagination,
  just one long list. Added real-time search and 5-per-page pagination to
  both (client-side, shared hook).
- SEO/AEO baseline. The site previously served no `robots.txt` and no
  `sitemap.xml` (both 404), and every one of the 19 routes shared a single
  title/description from the root layout — there was no per-page metadata
  anywhere, no canonicals, no OpenGraph/Twitter cards and no structured data.
  Added `app/robots.ts`, `app/sitemap.ts`, a generated `/og.png` share card,
  and `lib/seo.ts` as the single source of truth for metadata. Because every
  page is a client component (which cannot export `metadata`), per-route
  titles are supplied by thin server `layout.tsx` wrappers — one per route,
  with authenticated surfaces marked `noIndex`. For AEO: Organization /
  WebSite / SoftwareApplication JSON-LD, a homepage FAQ section with FAQPage
  markup (native `<details>`, so answers are in the SSR HTML without JS), and
  `public/llms.txt`. The schema carries an explicit `alternateName` and the
  FAQ disambiguates EvaluLabs from `evalulab.com`, an unrelated Montreal
  cosmetics lab that currently owns the "evalulabs" SERP.
- **SEO/GEO/AEO execution playbook:** `docs/SEO_GEO_AEO_PLAN.md` (phased plan
  for ongoing search and answer-engine work — update the decision log there
  when implementing).
- SEO/GEO/AEO pass against that playbook (2026-09-24). Robots now disallows
  enterprise workspace routes and `/analytics`, and names the major AI search
  crawlers with the same allow/disallow policy. Sitemap drops `/login` and adds
  `/blogs/ai-technical-interview`, `/blogs/ai-coding-interview`, and
  `/blogs/interview-proctoring`. `/companies` and `/skills` keep a public
  server intro (catalog names and CTAs only) and no longer redirect logged-out
  visitors to login; the picker still requires an account. Homepage metadata
  and FAQ JSON-LD live on the server page. Brand copy, `llms.txt`, and
  `llms-full.txt` cover practice and enterprise screening, coding, and
  proctoring without claiming a hidden test runner or gaze/low-light checks.

## Next
Open GitHub issues:
- #5 — add more companies to `seed_companies.py` (only 6 exist right now)
- #6 — automatic documentation updates on code changes (needs scoping —
  this is a CI/tooling decision, not a small change)

Still not started from the original spec:
- Phase 9 — custom Next.js admin panel (still using Django's built-in admin)
- Phase 10 — production deploy setup (no prod Dockerfile/config yet)

## Decisions / deviations from spec
- Next.js pinned to 14.2.35 (patched version for Dec 2025 RSC CVEs)
- All four app stubs registered in INSTALLED_APPS in Phase 0 (empty, no models)
  so the folder structure is fully in place from the start.
- `InterviewSession` uses `settings.AUTH_USER_MODEL` (not a direct import of
  `User`) — correct Django pattern to avoid circular imports.
- Login uses email lookup + authenticate(username=...) because Django's
  default backend authenticates by username; no custom backend needed.
- CompanyListView uses flat CompanyListSerializer (no nested roles) to keep list
  payloads small; full nesting only on /api/companies/<id>/ detail endpoint.
- Token refresh uses a queue to prevent race conditions when multiple requests
  fire simultaneously on a stale access token.
- User snapshot stored in `ix_user` localStorage to avoid a round-trip on
  every page load; cleared on logout.

## Known issues
- `interviews_this_month` never resets monthly and `subscription_end_date`
  is never checked anywhere — free users effectively get 2 interviews
  total (not 2/month), and paid plans don't expire or renew automatically.
- The round list UI expects a `round_type` field the backend doesn't send —
  round type badges render blank.
- Seeded company `tone_style` values (`formal_strict`, `casual_friendly`)
  don't match the interview prompt's tone keys (`formal`, `casual`,
  `aggressive`) — affected companies fall back to a generic tone instead
  of the intended one.
- No rate limiting on login/register/OTP endpoints.
- No automated frontend tests (the backend has a Django test suite; CI runs it plus frontend lint/type-check/build — see "Deploy & CI").
- Local dev needs real Razorpay test-mode keys in `.env` to complete a
  payment or top-up purchase — without them it fails with a clean
  "Authentication failed" error. Expected, not a bug.

## Candidate portal: free platform, live jobs, practice (apps/careers)
- `PLATFORM_FREE` (default true): `effective_plan()` returns `max` and `effective_monthly_limit()` the Max limit (50) for every candidate. Set `PLATFORM_FREE=false` to restore the tiers. Sponsorship campaigns still set their own interview limit.
- `/jobs` (Live jobs): ~1,100 companies' own public careers boards on Greenhouse, Lever, Ashby and SmartRecruiters (SmartRecruiters fetched with `country=in` — Swiggy, Bosch India, ServiceNow, NielsenIQ…; description fetched lazily like Greenhouse) (keyless JSON APIs; `JobBoard` rows seeded from `careers/data/job_boards.json`, every slug verified live when the list was built) plus the Remotive/Arbeitnow aggregator feeds — ~45k open roles. The platform targets Indian candidates: each job stores `in_india` (located in India, or remote and open to anywhere/APAC/Asia — `feeds.is_india_job`), and the page defaults to `region=india` with a "Worldwide" toggle. Postings older than `JOB_MAX_AGE_DAYS` (60) are skipped at ingest and deleted at the end of every sweep (saved jobs/applications keep their snapshot; their FK goes null). A sweep runs once per `JOB_REFRESH_HOURS` (5), driven by the **`job_sweeper` compose service** (`manage.py sweep_jobs`, checks every 10 min, `--once` for a one-shot) so it never runs inside daphne. Sweeps are claimed under a row lock (`feeds.claim_sweep`); one left "running" for over an hour (process died mid-sweep) is reclaimed. Without the sweeper (`JOB_SWEEPER_EXTERNAL` unset) the first request after expiry claims it and runs it on a background thread; with it, requests only step in once the feed is 2× stale (`JOB_REFRESH_SYNC=true` runs it inline, used by tests). `manage.py refresh_jobs` forces one. Re-sweeps only write rows whose fields changed (an unchanged board costs zero writes). Descriptions keep one line per paragraph and "- " bullets (`feeds._clean_description`); the jobs page renders them as headings/lists and recovers structure from older flat descriptions. Boards are fetched over a thread pool (`JOB_FETCH_CONCURRENCY`, default 16) with one low-concurrency retry pass; a full sweep takes ~1 min after the first (~4 min cold, mostly skill extraction). Closed roles disappear from a company's board, so they're deleted on the next sweep; a board failing 5 sweeps in a row deactivates itself (admin can re-enable). Greenhouse list payloads carry no description, so it's fetched lazily (`feeds.ensure_description`) when a job is opened or ATS-checked. Each job stores `work_mode` (remote/hybrid/onsite), `level` (entry/mid/senior, title keywords then "N years" in the description) and `skills` (skill graph) at ingest; newest 200 per board kept.
- Filters: text (title/company/skill), location, work mode, experience level, posted within 1/3/7/30 days; sort "Best match" (`careers/matching.py`: skill overlap + target-role title overlap + level fit + work-mode/location preference nudges, over the newest 2,000 SQL-prefiltered candidates) or "Most recent". Save / Share (`/jobs?job=<id>` pins that job) / Apply (opens the posting and records a `JobApplication`).
- `/profile`: `CandidateProfile` filled once from an uploaded resume (`careers/profile_parser.py`: one OpenRouter call when `OPENROUTER_API_KEY` is set, deterministic rules otherwise or on any failure), then edited by hand. Tabs: Profile (resume download/replace/remove, basics, skills, experience, education, projects, certifications), Applications (tracker with status + notes, manual entries for roles found elsewhere), Saved jobs, Job preferences (target roles, locations, work modes, level → Best match). Saved/applied rows snapshot the posting so they survive it closing. The profile resume is used automatically for ATS checks when nothing is uploaded/pasted.
- Per-job ATS check = local skill-graph keyword matching (`careers/skillgraph.py`, `ats.py`) — no LLM, zero cost. 15 checks/day free; the stored `pro` plan (sold as "ATS Unlimited", ₹199/mo) or any paid plan/sponsorship is unlimited (`has_unlimited_ats()`). Resume can be uploaded (PDF/DOCX/text, 5 MB; parsed locally with pypdf/python-docx — scanned-image PDFs and legacy .doc unsupported), pasted, or taken from the profile. Text/profile checks are sent as JSON, never as an empty multipart body: Twisted (under daphne) answers a part-less multipart POST with a bare 400 before Django/CORS runs, which the browser surfaced as "Something went wrong."
- The candidate sidebar no longer shows Partner (partners still reach `/partner` directly and via the partner shell); it shows Profile instead.
- `/practice`: type an answer to an approved `InterviewQuestion` that has an `ideal_answer`, get a 0–10 score from local term-coverage scoring (`careers/practice.py`) — no LLM, no Jev, zero cost. Jev is used for the ATS check only.
- Known limits: feed content depends on third-party free APIs; job descriptions with no recognisable skills return 422.
- Optional Jev (TypeSafe) second opinion on ATS checks (`careers/jev.py`): enabled only when `TYPESAFE_API_KEY` is set. Jev is a decision model (no parsing/generation), so it judges locally-extracted resume text: one fit Score + one Noul per missing keyword (confirmed ≥0.75 moves a keyword to matched). One ~3–4k-token call per check, 8s timeout, any failure falls back to the keyword result. Skipped for over-quota users.
- Pricing while `PLATFORM_FREE`: everything is free; the only thing sold is ₹199/mo **ATS Unlimited** (the existing `pro` plan, relabelled via `plan_label()`). `purchasable_plans()` = `{"pro"}`, top-up packs are rejected (400) by the create-order endpoints, `/pricing` shows only Free vs ATS Unlimited, top-up/upgrade buttons are hidden. `/me` and login payloads carry `platform_free` and `ats_unlimited`; logged-out pages use `NEXT_PUBLIC_PLATFORM_FREE` (default true). Reviews, the bonus-interview admin action and interview-limit messages now use `effective_plan()`.

## Graph engine (`core/graph.py`) and the ATS graph (`apps/careers/graphs.py`)
- `core/graph.py`: tiny plain-Python graph runner (no deps). Nodes are `fn(state) -> partial dict`, static `.edge()`, code-controlled `.route()` routers, per-node `.on_error()` fallback, `END`, `max_steps` guard, per-run trace `[{node, ms, error}]` (logged at DEBUG). Routing is always decided in code, never by a model.
- **ATS graph**: `parse_resume` (400) → `load_job` (404) → `keyword_score` (422) → `quota_precheck` (429, before any paid call) → `jev_assess` only if Jev enabled (failure → `save`) → `rescore` only if Jev answered → `save` (locked transaction, re-checks quota, writes `ResumeCheck`). `ResumeCheckView` just runs the graph; HTTP behaviour unchanged.
- Next: the interview loop (`apps/interviews` start/chat/end) as a graph — separate PR, not started.

## Deploy & CI
- **Migrations run on every deploy.** `backend/docker-entrypoint.sh` is the image `ENTRYPOINT`, so it runs before any command — including compose's `command:` override (previously the entrypoint was the `CMD`, which compose replaced, so `docker compose up` never migrated). It runs `manage.py migrate_on_deploy`: waits for Postgres, then `migrate` under a Postgres advisory lock so several containers starting at once migrate one at a time. The RQ worker uses `RUN_MIGRATIONS=wait` (waits until the schema is current, never migrates); `RUN_MIGRATIONS=false` skips. It also runs `collectstatic` (`COLLECTSTATIC=false` skips).
- **Lint gates every build.** ESLint is configured (`frontend/.eslintrc.json`, `next/core-web-vitals`); the frontend image runs `npm run lint` and an error fails the build. `npm run lint:fix` fixes what's auto-fixable.
- **CI** (`.github/workflows/ci.yml`, every push to main and every PR): `makemigrations --check` (a deploy can only apply migrations that exist), backend tests on Postgres 15, frontend lint, `tsc --noEmit` and `next build`.

