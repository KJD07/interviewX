# STATE.md
## Current phase
Phase 2 — JWT auth: register/login/refresh endpoints + custom User model wiring (not started)

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

## Phase 1 Checkpoint (run these after pulling)
```bash
docker compose up --build -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
# visit http://localhost:8000/admin — confirm all models appear:
# Users, Companies, Roles, Rounds, InterviewQuestions, InterviewSessions
# Manually add one test Company via admin
```

## Next
Phase 2 — JWT auth: register/login/refresh endpoints

### What Phase 2 must deliver:
- `apps/accounts/serializers.py` — RegisterSerializer, LoginSerializer
- `apps/accounts/views.py` — RegisterView, LoginView (using simplejwt)
- `apps/accounts/urls.py` — routes for /api/auth/register/, /api/auth/login/
- `backend/config/urls.py` — wire auth URLs + simplejwt refresh endpoint
- Verified checkpoint: POST /api/auth/register/ and /api/auth/login/ return tokens

## Decisions / deviations from spec
- Next.js pinned to 14.2.35 (patched version for Dec 2025 RSC CVEs)
- All four app stubs registered in INSTALLED_APPS in Phase 0 (empty, no models)
  so the folder structure is fully in place from the start.
- `InterviewSession` uses `settings.AUTH_USER_MODEL` (not a direct import of
  `User`) — correct Django pattern to avoid circular imports.

## Known issues
- None
