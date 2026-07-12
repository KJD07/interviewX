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
- Basic voice mode — Web Speech API based speech-to-text/text-to-speech
  during interviews (this is the spec's Phase 8, in early form)
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
- No automated tests, backend or frontend.
- Local dev needs real Razorpay test-mode keys in `.env` to complete a
  payment or top-up purchase — without them it fails with a clean
  "Authentication failed" error. Expected, not a bug.
