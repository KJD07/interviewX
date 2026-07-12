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
- Auth: JWT via `djangorestframework-simplejwt`, plus Google Sign-In and email OTP verification
- Payments: Razorpay (plan subscriptions + mid-month interview top-ups)
- Voice: Web Speech API (basic speech-to-text/text-to-speech during interviews)

## Build process

This project started out built one phase at a time, each in its own Claude
chat, following `STEP_BY_STEP_GUIDE.md`. Ongoing work is now also tracked
as GitHub issues on this repo. See `STATE.md` for what's actually built.
