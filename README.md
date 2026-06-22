# AI Interview Simulator

Practice real interviews with an AI interviewer. See `PROJECT_MASTER_SPEC.md`
for the frozen spec and `STATE.md` for current build progress.

## Quickstart (local dev)

1. Copy `.env.example` to `.env` and fill in real values:
   ```bash
   cp .env.example .env
   ```
2. Build and start everything:
   ```bash
   docker compose up --build
   ```
3. Visit:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000
   - Django admin: http://localhost:8000/admin (after Phase 1 migrations + `createsuperuser`)

## Stack

- Frontend: Next.js 14.2.x (App Router), TypeScript, TailwindCSS 3.x
- Backend: Django 5.0.x + DRF 3.15.x, Python 3.11
- Database: PostgreSQL 15
- LLM: OpenRouter (`openai/gpt-4o-mini`)
- Auth: JWT via `djangorestframework-simplejwt`
- Payments: Razorpay (Phase 7+)

## Build process

This project is built one phase at a time, each in its own Claude chat,
following `STEP_BY_STEP_GUIDE.md`. Do not skip steps or merge phases.
