# STEP-BY-STEP BUILD GUIDE — AI Interview Simulator
Follow this top to bottom. Don't skip steps. Each step tells you exactly what to do, what to paste, what to expect back, and where to save it.

Required once before Step 1:
- A GitHub account
- GitHub Desktop installed (github.com/desktop) — lets you commit/push by clicking, no terminal needed
- Docker Desktop installed (docker.com) — needed to actually run the app locally
- `PROJECT_MASTER_SPEC.md` and `STATE.md` (already given to you) saved somewhere on your computer

---

## STEP 1 — Create the repo

1. Go to github.com → New repository → name it `ai-interview-simulator` → Private → Create.
2. Open GitHub Desktop → File → Clone Repository → pick `ai-interview-simulator` → choose a local folder, e.g. `Documents/ai-interview-simulator`.
3. Put `PROJECT_MASTER_SPEC.md` and `STATE.md` into that folder's root.
4. In GitHub Desktop: write commit message "Initial spec docs" → Commit to main → Push origin.

✅ Checkpoint: refresh your GitHub repo page in a browser — you should see both files there.

---

## STEP 2 — Run Phase 0 (Docker skeleton)

1. Open a **brand new** Claude chat.
2. Paste this exactly:

```
Here is the frozen spec for my project. Do not deviate from it.

[paste full contents of PROJECT_MASTER_SPEC.md]

Current STATE.md:
[paste full contents of STATE.md]

Relevant existing files for this session: none yet, starting fresh.

Task for this session: Build PHASE 0 only, as defined in Section 7 — repo + Docker skeleton. I need: docker-compose.yml, a minimal Django project that boots, a minimal Next.js project that boots, and Postgres wired up so all three talk to each other. Give me every file in full.
```

3. Claude will give you full file contents. For each file, create it at the matching path shown in Section 3 of the spec (e.g. `docker-compose.yml` at repo root, `backend/manage.py`, `frontend/package.json`, etc.).
4. At the end of the chat, paste this:

```
Before we end:
1. Give me the final, complete contents of every file you changed or created this session.
2. Update STATE.md: what's done, what's next, any deviations made and why.
3. Give me the exact git commands to commit and push (I'm using GitHub Desktop, so just give me the commit message to type, not raw git commands).
```

5. Save the updated `STATE.md` over your old one.

✅ Checkpoint before moving on — test it actually runs:
- Open a terminal in your repo folder, run `docker compose up --build`.
- No red errors. Visit `http://localhost:8000` (Django) and `http://localhost:3000` (Next.js) — both should load something, even a default page.
- If you get errors: paste the exact error text back into the *same* chat (don't start a new one mid-error) and ask it to fix. Only move to Step 3 once `docker compose up` is clean.
6. In GitHub Desktop: commit with the message Claude gave you, push.

---

## STEP 3 — Run Phase 1 (Database models)

1. New chat. Paste the Step 2 template, but this time:
   - "Current STATE.md" = your **updated** STATE.md from Step 2.
   - "Relevant existing files" = paste `backend/config/settings.py` and any models files that already exist (probably none yet).
   - Task = "Build PHASE 1 only — Django models per Section 4, migrations, and register all models in Django admin."
2. Save files Claude gives you to the matching paths.
3. Run the Closer template from Step 2.4 again. Update STATE.md.

✅ Checkpoint:
- `docker compose up --build`
- In a new terminal: `docker compose exec backend python manage.py migrate` — should run with no errors.
- `docker compose exec backend python manage.py createsuperuser` — make yourself an admin.
- Visit `http://localhost:8000/admin` — log in, confirm you see Company, Role, Round, InterviewQuestion, User, InterviewSession listed. Manually add one test Company there.
- Commit + push.

---

## STEP 4 — Run Phase 2 (JWT auth)

Same pattern as Step 3:
- Task = "Build PHASE 2 only — JWT register/login/refresh endpoints."
- Paste in `backend/config/urls.py`, `backend/config/settings.py`, and the User model file as "relevant existing files."

✅ Checkpoint: use a tool like Postman, or `curl`, to hit `/api/auth/register/` and `/api/auth/login/` and confirm you get a token back. Commit + push.

---

## STEP 5 — Run Phase 3 (Companies/Roles/Rounds API + seed data)

- Task = "Build PHASE 3 only — `/api/companies/` endpoint plus a seed script with 2-3 real companies, roles, rounds, and a few real questions for testing."
- Paste in the models file and urls.py as context.

✅ Checkpoint: run the seed script, then hit `GET /api/companies/` in a browser or Postman — you should see nested JSON (companies → roles → rounds). Commit + push.

---

## STEP 6 — Run Phase 4 (OpenRouter interview engine)

- Task = "Build PHASE 4 only — `openrouter_client.py` plus `/start/`, `/chat/`, `/end/` endpoints, text-only, using `openai/gpt-4o-mini`."
- You'll need an OpenRouter API key (openrouter.ai → sign up → create key) before this step — get that first and add it to your `.env` file as `OPENROUTER_API_KEY`.

✅ Checkpoint: use Postman to: start a session (get a session id) → send a chat message → confirm you get an AI reply back → end the session → confirm scores/feedback come back. This is the riskiest step — if something breaks, paste the exact error into the same chat before moving on. Commit + push.

---

## STEP 7 — Run Phase 5 (Frontend auth + dashboard)

- Task = "Build PHASE 5 only — Next.js login/register pages and dashboard with company/role/round picker, wired to the real backend API."

✅ Checkpoint: visit `localhost:3000`, register a user through the UI, log in, see the company list load for real (not mock data). Commit + push.

---

## STEP 8 — Run Phase 6 (Interview UI + feedback page)

- Task = "Build PHASE 6 only — text interview chat UI and the post-interview feedback page."

✅ Checkpoint: click through the full user journey in the browser — pick a round, chat with the AI, end it, see scores and feedback. This is your first real end-to-end working MVP. Commit + push.

---

## STEP 9 — Run Phase 7 (Subscriptions + Razorpay)

- You'll need a Razorpay account (test mode) and API keys before this step.
- Task = "Build PHASE 7 only — free plan limit (2/month) enforcement and Razorpay checkout for ₹499/month."

✅ Checkpoint: try to start a 3rd interview on a free account, confirm it's blocked. Run a test payment through Razorpay's test mode, confirm plan upgrades. Commit + push.

---

## STEP 10 — Run Phase 8 (Voice)

Only start this once Steps 1-9 are solid and committed. This is the most failure-prone phase — expect to spend more iterations here than any other step.

- Task = "Build PHASE 8 only — add voice input/output on top of the existing text engine, without breaking the text fallback."

---

## STEP 11 — Run Phase 9 (Custom admin panel)

- Task = "Build PHASE 9 only — Next.js admin UI for managing companies/roles/rounds/questions, replacing manual use of Django admin."

---

## STEP 12 — Run Phase 10 (Deploy)

- Task = "Build PHASE 10 only — production Docker setup and deployment instructions for [Render/Railway/your choice]."

---

## RULES THAT APPLY TO EVERY STEP ABOVE

- One phase per chat. Never ask a chat to "do the next two phases."
- Always paste the current `STATE.md` — it's how each new chat knows what already exists.
- Always hit the checkpoint before moving to the next step. If a checkpoint fails, fix it in the *same* chat, not a new one.
- Always commit + push before opening the next chat. If it's not pushed, the next chat is working blind.
- If a chat ever proposes something that contradicts `PROJECT_MASTER_SPEC.md`, paste the spec again and tell it to conform — don't let it improvise.
