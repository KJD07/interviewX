# STATE.md
## Current phase
Phase 3 — Company/Role/Round data endpoints (not started)

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

## Phase 2 Checkpoint (run these after pulling)
```bash
docker compose up --build -d
docker compose exec backend python manage.py migrate

# Register
curl -s -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"Str0ng!Pass","password2":"Str0ng!Pass"}' | python3 -m json.tool

# Login
curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Str0ng!Pass"}' | python3 -m json.tool

# Refresh (paste refresh token from login response)
curl -s -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh":"<REFRESH_TOKEN>"}' | python3 -m json.tool
```

## Next
Phase 3 — Company/Role/Round read endpoints

### What Phase 3 must deliver:
- `apps/companies/serializers.py` — CompanySerializer, RoleSerializer, RoundSerializer, InterviewQuestionSerializer
- `apps/companies/views.py` — list/detail views (read-only for regular users, write via admin)
- `apps/companies/urls.py` — /api/companies/, /api/companies/<id>/roles/, /api/companies/<id>/roles/<id>/rounds/
- `backend/config/urls.py` — wire companies URLs
- Verified checkpoint: authenticated GET requests return company/role/round data

## Decisions / deviations from spec
- Next.js pinned to 14.2.35 (patched version for Dec 2025 RSC CVEs)
- All four app stubs registered in INSTALLED_APPS in Phase 0 (empty, no models)
  so the folder structure is fully in place from the start.
- `InterviewSession` uses `settings.AUTH_USER_MODEL` (not a direct import of
  `User`) — correct Django pattern to avoid circular imports.
- Login uses email lookup + authenticate(username=...) because Django's
  default backend authenticates by username; no custom backend needed.

## Known issues
- None
