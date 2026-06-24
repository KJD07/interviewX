# STATE.md
## Current phase
Phase 4 — InterviewSession endpoints (not started)

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
  (BEFORE any migration was ever run — critical ordering satisfied)
- `apps/accounts/models.py` — custom `User(AbstractUser)` with exact field names
  from spec Section 4: `subscription_plan`, `interviews_this_month`, `subscription_end_date`
- `apps/companies/models.py` — `Company`, `Role`, `Round`, `InterviewQuestion`
  with exact field names from spec Section 4
- `apps/interviews/models.py` — `InterviewSession` referencing `settings.AUTH_USER_MODEL`
  and `apps.companies.models.Round`; transcript/scores as JSONField per spec
- `apps/subscriptions/models.py` — placeholder (real logic Phase 7)
- All admin files created: `accounts/admin.py`, `companies/admin.py`,
  `interviews/admin.py`, `subscriptions/admin.py`
  - UserAdmin extends BaseUserAdmin, exposes subscription fields
  - CompanyAdmin has RoleInline, RoleAdmin has RoundInline, RoundAdmin has
    InterviewQuestionInline — easy data entry during dev
- Migrations generated and committed:
  - `apps/accounts/migrations/0001_initial.py`
  - `apps/companies/migrations/0001_initial.py`
  - `apps/interviews/migrations/0001_initial.py`
- `manage.py check` → 0 issues (verified locally)
- `makemigrations` → clean output, no warnings

### Phase 2 ✅
- `apps/accounts/serializers.py` — RegisterSerializer (email uniqueness check,
  password confirmation, validate_password), LoginSerializer (email + password)
- `apps/accounts/views.py` — RegisterView (POST → 201 + tokens), LoginView
  (email lookup → authenticate by username → 200 + tokens); both AllowAny
- `apps/accounts/urls.py` — /api/auth/register/, /api/auth/login/
- `backend/config/urls.py` — auth URLs + simplejwt TokenRefreshView at
  /api/auth/token/refresh/; health check phase bumped to 2
- _token_response() helper returns access, refresh, and user snapshot
  (id, email, username, subscription_plan) in one payload

### Phase 3 ✅
- `apps/companies/serializers.py` — CompanyListSerializer (flat, for list),
  CompanySerializer (nested roles→rounds→questions, for detail),
  RoleSerializer (nested rounds→questions), RoundSerializer (nested questions),
  InterviewQuestionSerializer
- `apps/companies/views.py` — CompanyListView, CompanyDetailView, RoleListView,
  RoundListView, RoundDetailView; all require IsAuthenticated; prefetch_related
  used throughout to avoid N+1 queries
- `apps/companies/urls.py` — /api/companies/, /api/companies/<id>/,
  /api/companies/<id>/roles/, /api/companies/<id>/roles/<id>/rounds/,
  /api/companies/<id>/roles/<id>/rounds/<id>/
- `backend/config/urls.py` — companies URLs wired; health check bumped to phase 3

## Phase 3 Checkpoint (run these after pulling)
```bash
docker compose up --build -d
docker compose exec backend python manage.py migrate

# Get a token first (register or login from Phase 2)
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Str0ng!Pass"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")

# Seed some data via Django admin or shell, then:

# List companies
curl -s http://localhost:8000/api/companies/ \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Company detail (with nested roles/rounds/questions)
curl -s http://localhost:8000/api/companies/1/ \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Roles for a company
curl -s http://localhost:8000/api/companies/1/roles/ \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Rounds for a role
curl -s http://localhost:8000/api/companies/1/roles/1/rounds/ \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Single round with questions
curl -s http://localhost:8000/api/companies/1/roles/1/rounds/1/ \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Unauthenticated request should return 401
curl -s http://localhost:8000/api/companies/ | python3 -m json.tool
```

## Next
Phase 4 — InterviewSession endpoints

### What Phase 4 must deliver:
- `apps/interviews/serializers.py` — InterviewSessionSerializer
- `apps/interviews/views.py` — create session, list user's sessions, retrieve single session
- `apps/interviews/urls.py` — /api/interviews/, /api/interviews/<id>/
- `backend/config/urls.py` — wire interviews URLs
- Verified checkpoint: authenticated user can create and list their own sessions only

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

## Known issues
- None
