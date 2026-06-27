# STATE.md
## Current phase
Phase 7 — Interview flow UI (next)

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

## Next
Phase 7 — Interview flow UI
- `/companies` page: list companies → click to see roles → click role to see
  rounds → "Start interview" button calls POST /api/interviews/start/
- `/interview/[sessionId]` page: the chat interface (ChatView loop, End button)
- Route both from dashboard "Start interview" CTA and from the company browser

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
- None
