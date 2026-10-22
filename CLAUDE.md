# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

EvaluLabs — an AI mock-interview platform. Next.js frontend + Django REST
backend + Postgres, with an LLM (OpenRouter, `openai/gpt-4o-mini`) acting as
the interviewer and grader. See `PROJECT_MASTER_SPEC.md` for the original
frozen spec and `STATE.md` for what's actually built vs. planned — **STATE.md
is the authoritative log of current progress and known issues**, not the
spec. For SEO, GEO, and AEO work, follow `docs/SEO_GEO_AEO_PLAN.md`. Ongoing work is tracked as GitHub issues on this repo.

## Commands

### Local dev (Docker — the normal way to run this project)
```bash
cp .env.example .env      # fill in real values first
docker compose up --build
```
Frontend: http://localhost:3000 · Backend: http://localhost:8000 · Admin: http://localhost:8000/admin

### Backend (Django, from `backend/`)
```bash
python manage.py runserver
python manage.py migrate
python manage.py makemigrations <app>
python manage.py createsuperuser
python manage.py test                          # all tests
python manage.py test apps.accounts            # one app
python manage.py test apps.accounts.tests.SubscriptionCycleTests.test_free_user_counter_resets_after_30_days  # one test
python manage.py seed_companies                # apps/companies management command
python manage.py seed_skills                   # apps/companies management command
python manage.py rqworker default              # background interview-scoring worker (needs Redis)
```
Test gotchas: settings default to `DEBUG=False`, which turns on `SECURE_SSL_REDIRECT` — run tests with
`DJANGO_DEBUG=True` (or `DJANGO_SECURE_SSL_REDIRECT=False`) or API tests get 301s. The DB is Postgres
(`POSTGRES_HOST`, default `db` = the compose service). Without Redis, interview scoring runs inline
(`INTERVIEW_SCORING_SYNC=true` forces it).

### Frontend (Next.js, from `frontend/`)
```bash
npm run dev
npm run build
npm run lint
```

There is no automated frontend test suite (see STATE.md "Known issues").

## Architecture

### Backend: Django apps, one shared plans module
- `apps/accounts` — custom `User` model (`AUTH_USER_MODEL = "accounts.User"`), JWT auth (register/OTP-verify/login/Google sign-in), `EmailOTP`. `User.sync_subscription_state()` lazily downgrades lapsed subscriptions, rolls the monthly interview counter every 30 days, and attaches/expires/rolls institutional sponsorships (see below) — called on request (no Celery/cron worker exists), not on a schedule.
- `apps/companies` — `Company` → `Role` → `Round` → `InterviewQuestion`, all nested under `/api/companies/`. **Skills are `Company` rows with `kind="skill"` instead of `kind="company"`** — same models, same endpoints, filtered with `?kind=skill`; there is no separate skills table.
- `apps/interviews` — `InterviewSession` (transcript + scores + insights as JSONFields) plus the three AI-engine endpoints (`start/`, `<id>/chat/`, `<id>/end/`) that drive the whole interview loop through `core/openrouter_client.py`. Also owns `RealInterviewReport` (optional post-interview form, paid plans only) and `ProgressView` (score history for `/progress`).
- `apps/subscriptions` — `PaymentOrder` + **PayU** hosted checkout (`core/payu.py`; create-order returns form fields, PayU posts back to `/api/subscriptions/payu/success|failure/`, stuck orders are reconciled lazily), for both plan upgrades and mid-month interview top-up packs (Spark/Boost/Power — credits that roll over and don't reset on renewal). Partner/coupon discounts come from `apps/enterprise` `ReferralPartner` codes. Also owns `SponsorshipCampaign` (institutional/college partnerships). (README and old migrations still say Razorpay — that integration was replaced.)
- `apps/reviews` — a single star-rating `Review` per user (`OneToOneField`), prompted periodically on the frontend after interviews complete.
- `apps/careers` — candidate portal: live jobs from ~1,090 company boards (Greenhouse/Lever/Ashby, list in `careers/data/job_boards.json`, swept every 5h on a background thread — `manage.py refresh_jobs` forces it), candidate profile filled from an uploaded resume, saved jobs + application tracker, ATS resume check, typed practice (see "Free platform + ATS graph" below).
- `apps/enterprise` — B2B side: `Organization`/members, candidate invites, uploaded question banks, scored reports, proctoring events, enterprise payments, and the referral-partner/commission program. Its opt-in live camera viewer is the only WebSocket (`ws/enterprise/live/<id>/`, Django Channels, in-memory channel layer), which is why the backend runs under **daphne/ASGI**, not plain `runserver`/WSGI, in compose.
- `apps/support` — public, throttled site-help chatbot (`POST /api/support/chat/`) on top of `chat_completion()`.
- `apps/subscriptions/plans.py` is the **single source of truth** for plan tiers (free/pro/premium/max), monthly limits, and top-up packs — both the interviews app (limit checks) and subscriptions app (payments) import from it. Never hardcode plan limits/prices elsewhere.

### Institutional sponsorship campaigns
- `SponsorshipCampaign` (`apps/subscriptions/models.py`) grants every user whose email matches `email_domain` (e.g. `thapar.edu`) a `granted_plan`'s feature set, capped at `interview_limit` interviews per `cycle_days`, while `sponsor_covers_until` is in the future. Created and managed entirely through Django admin — no public signup flow or API.
- A sponsored user's own `subscription_plan`/`interviews_this_month` fields are **never** touched by the campaign — attachment/expiry/rollover lives entirely in the parallel `sponsorship_campaign` / `sponsorship_cycle_start` / `sponsorship_interviews_used` fields on `User`, evaluated lazily in `User.sync_subscription_state()`.
- Because the raw field is left alone, **any code gating a feature/limit by plan tier must call `effective_plan(user)` / `effective_monthly_limit(user)` from `apps/subscriptions/plans.py`, never read `user.subscription_plan` directly** — those two helpers return the campaign's granted plan/limit for sponsored users and fall back to the real field otherwise. (`apps/companies/views.py` was previously missed and shipped this bug — sponsored users saw only free-tier companies/skills — before being fixed to use `effective_plan()`.)
- Admin gotcha: `sponsor_covers_until` has no default and must be set to a real future date when creating a campaign — the Django admin's "Today"/"Now" shortcut links fill in the current moment, which if left as-is makes the campaign expire immediately.

### Free platform + ATS graph
- `settings.PLATFORM_FREE` (default true) makes `effective_plan()` return `max` for every candidate. The only thing sold is ₹199/mo "ATS Unlimited" (the `pro` plan; `plan_label()`, `purchasable_plans()`, `has_unlimited_ats()` in `plans.py`). ATS unlimited is deliberately keyed on the *stored* plan, since the effective plan is always Max.
- `apps/careers` (live jobs, ATS resume check, typed practice) runs its multi-step ATS check through `core/graph.py`, a tiny plain-Python graph runner (nodes return partial state, routers decided in code, `on_error` fallbacks, `max_steps`, per-run trace). The ATS graph lives in `apps/careers/graphs.py` (parse → job → keyword score → quota pre-check → optional Jev → rescore → save); `ResumeCheckView` just runs it and maps its state to a Response. Practice scoring is plain keyword scoring (`careers/practice.py`), not a graph. The optional TypeSafe Jev model (`careers/jev.py`) is used **only** for the ATS check, is off unless `TYPESAFE_API_KEY` is set, and every failure falls back to the deterministic keyword result.

### The interview loop (core of the product)
1. `POST /api/interviews/start/` — checks plan/top-up limit via `subscriptions/plans.py`, builds a system prompt via `build_interview_system_prompt()` (per-company tone: `formal_strict` / `casual_friendly` / `aggressive`, driving the AI's persona), creates an `InterviewSession` with a randomized 45–60 min `duration_minutes`.
2. `POST /api/interviews/<id>/chat/` — appends to `transcript` JSONField, calls `core/openrouter_client.chat_completion()`.
3. `POST /api/interviews/<id>/end/` — moves the session to scoring and hands grading to `apps/interviews/scoring.py`: enqueued on the RQ `default` queue (the compose `scoring_worker` service) when `REDIS_URL`/`REDIS_HOST` is set, otherwise run inline. Grading runs `build_feedback_prompt()` against the full transcript to get `scores` (communication/technical/problem_solving/overall, 0–10) and `feedback`. Paid plans (`has_insights()` in plans.py) additionally get `insights` (topic breakdown + improvement areas) via `detailed=True` — free plan sessions never request this, to keep free interviews cheap. The grading rubric is deliberately strict (anchored 0–10 scale, blank/"I don't know" answers must score 0–2) — see the prompt-building functions in `core/openrouter_client.py` before changing scoring behavior.
- `core/question_sourcing.py` — separate, admin-triggered pipeline (`POST .../generate-questions/`) that uses a web-search-enabled OpenRouter model to source real candidate-reported interview questions, distinct from the interview/feedback prompts above.

### Frontend: Next.js App Router
- `lib/api.ts` — single fetch wrapper for the whole app: JWT bearer injection, auto-refresh on 401 with a queue (prevents concurrent-request races on a stale access token), typed endpoint functions, `ApiError`, and `tokens` (localStorage access/refresh). Add new backend endpoints here rather than calling `fetch` directly from components.
- `context/AuthContext.tsx` — auth state (`user`, `loading`, `login`, `register`, `logout`); user snapshot persisted to `ix_user` in localStorage for instant hydration on reload, cleared on logout.
- `components/ProtectedRoute.tsx` — wraps authenticated pages, redirects to `/login` if unauthenticated.
- `hooks/useSearchAndPaginate.ts` — shared client-side search/pagination hook (5 per page, search ignores pagination and shows all matches) used by the companies/skills list pages, the dashboard session history table, and the progress page's per-company breakdown.
- Theming: `globals.css` defines one light, warm palette (`--page`, `--surface`, `--ink`, `--accent`, etc.) applied uniformly to every plan tier. `data-plan` is still set on `<body>` by `AppShell` for plan-gated logic/labels, but it no longer changes colors — don't reintroduce per-tier color overrides without being asked.

### Cross-cutting notes
- Plan/limit logic must be checked in exactly one place: `apps/subscriptions/plans.py`. If you're adding a feature gated by plan tier, add the check there, not inline — and gate on `effective_plan(user)`/`effective_monthly_limit(user)`, not the raw `user.subscription_plan` field, so sponsored users are covered too.
- `InterviewSession.round` uses `Round`, not `Company`/`Role` directly — company/role names are reached through the FK chain (`round.role.company`).
- `Round.infer_round_type()` is a best-effort classifier used by seed commands only, based on keyword matching in the round title — not run at request time.
- Company `tone_style` values in seed data must match the tone keys `build_interview_system_prompt()` understands (`formal_strict`, `casual_friendly`, `aggressive`); see STATE.md "Known issues" — some seeded companies currently don't match and fall back to a generic tone.
- Production hardening (HSTS, secure cookies, SSL redirect) in `config/settings.py` is gated on `DEBUG=False` — don't test prod-only behavior with `DJANGO_DEBUG=True` set.
- The only background worker is the RQ interview-scoring worker, and it's optional (inline fallback). There is no Celery/cron/scheduler — anything resembling a scheduled job (subscription renewal, monthly counter reset, job-feed refresh) must be lazy, evaluated on the next request (see `User.sync_subscription_state()`, `careers/feeds.refresh_if_stale()` — which claims the sweep on-request but runs it on a background thread).
- Redis, when configured, is used twice: DB 0 for RQ, DB 1 for the Django cache behind `core/read_cache.py` (hot catalog reads, versioned invalidation). Without Redis the cache is LocMem.
