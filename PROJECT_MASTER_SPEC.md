# AI Interview Simulator — MASTER SPEC (v1.0)
**This document is FROZEN. Do not let any chat reinterpret or "improve" it. Paste this entire file at the start of every new Claude chat working on this project.**

---

## 0. HOW TO USE THIS ACROSS MULTIPLE CHATS

1. GitHub repo `ai-interview-simulator` is the single source of truth. Code lives there, not in chat history.
2. Every new chat starts with the **Session Starter Template** (Section 9) — this spec + current repo state + the one phase being worked on.
3. Every chat ends with the **Session Closer Template** (Section 9) — Claude outputs an updated `STATE.md` + exact commands to commit/push.
4. You manually copy code Claude gives you into your local folder, run it, and push to GitHub. Never skip pushing — if it's not pushed, the next chat won't know it exists.
5. **One phase per chat.** Don't ask a fresh chat to "continue building everything" — paste the specific phase from Section 8.
6. If a new chat ever suggests a different tech stack, different folder names, or different model slugs than what's below — stop, paste this spec again, and tell it to conform.

---

## 1. TECH STACK (frozen, exact versions)

| Component | Exact choice |
|---|---|
| Frontend | Next.js 14.2.x (App Router), TypeScript, TailwindCSS 3.x |
| Backend | Django 5.0.x + Django REST Framework 3.15.x, Python 3.11 |
| Database | PostgreSQL 15, in Docker |
| Containerization | Docker + Docker Compose v2 (`docker compose`, not `docker-compose`) |
| LLM Provider | OpenRouter — OpenAI-compatible endpoint `https://openrouter.ai/api/v1/chat/completions` |
| Auth | Django + `djangorestframework-simplejwt` (JWT). No Clerk, no Supabase, no Auth0. |
| Payments | Razorpay — added in Phase 7, not before |
| Speech | NOT in MVP. Added in Phase 8 only, after text interview works end-to-end |

**OpenRouter model slugs to use (real, working as of June 2026):**
- Primary interview LLM: `openai/gpt-4o-mini` (cheap, reliable, good tool support)
- Free-tier fallback / experimentation: `google/gemma-4-31b-it:free` (you've used this successfully before)
- Do NOT invent slugs like `openrouter/gpt-4o` or `openrouter/claud-3.5` — they don't exist. Format is always `provider/model-name`, no `openrouter/` prefix on the model itself.
- Before using any model slug, check it's live at https://openrouter.ai/models — free-tier slugs rotate.

---

## 2. MVP SCOPE — PHASE 1 IS TEXT ONLY

The interview interface is a **text chat** (like a normal chatbot), not voice, until every other feature works end to end. No Whisper, no TTS, no Web Speech API, no <2s latency requirement, until Phase 8.

---

## 3. REPO STRUCTURE (do not deviate)

```
ai-interview-simulator/
├── STATE.md                 # living doc — current progress, updated every session
├── docker-compose.yml
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── config/               # Django settings, urls
│   ├── apps/
│   │   ├── accounts/          # custom User model + JWT auth
│   │   ├── companies/         # Company, Role, Round, InterviewQuestion
│   │   ├── interviews/        # InterviewSession, chat engine
│   │   └── subscriptions/     # plan limits, Razorpay (Phase 7+)
│   └── core/
│       └── openrouter_client.py
├── frontend/
│   ├── package.json
│   ├── Dockerfile
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login, register
│   │   │   ├── dashboard/
│   │   │   ├── interview/[roundId]/
│   │   │   ├── feedback/[sessionId]/
│   │   │   └── admin/
│   │   ├── components/
│   │   └── lib/               # api.ts (fetch wrapper), auth.ts
└── docs/
    └── api.md
```

Class/file/variable names must match this structure exactly across chats. Do not let a chat rename `apps/interviews` to `apps/interview`, etc.

---

## 4. DATABASE SCHEMA (frozen field names)

```python
class Company(models.Model):
    name = models.CharField(max_length=100)
    tone_style = models.CharField(max_length=50)  # e.g. "formal_strict"
    description = models.TextField(blank=True)

class Role(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="roles")
    title = models.CharField(max_length=100)

class Round(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="rounds")
    title = models.CharField(max_length=100)
    order = models.IntegerField(default=0)

class InterviewQuestion(models.Model):
    round = models.ForeignKey(Round, on_delete=models.CASCADE, related_name="questions")
    question_text = models.TextField()
    question_type = models.CharField(max_length=20)  # mcq / coding / behavioral
    ideal_answer = models.TextField(blank=True)
    source_url = models.CharField(max_length=255, blank=True)

class User(AbstractUser):
    subscription_plan = models.CharField(max_length=20, default="free")  # free / premium
    interviews_this_month = models.IntegerField(default=0)
    subscription_end_date = models.DateTimeField(null=True, blank=True)

class InterviewSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    round = models.ForeignKey(Round, on_delete=models.CASCADE)
    transcript = models.JSONField(default=list)  # [{"role": "user"/"ai", "text": "...", "ts": "..."}]
    scores = models.JSONField(default=dict)       # {"communication": 8, "technical": 7, "problem_solving": 9}
    feedback = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
```

---

## 5. API CONTRACT (frozen endpoint names)

```
POST   /api/auth/register/
POST   /api/auth/login/
POST   /api/auth/refresh/
GET    /api/companies/                       -> companies + nested roles + rounds
POST   /api/interviews/start/                -> {round_id} -> checks plan limit, creates session
POST   /api/interviews/<id>/chat/            -> {message} -> returns AI reply
POST   /api/interviews/<id>/end/             -> generates scores + feedback
GET    /api/interviews/<id>/                 -> full session detail
GET    /api/subscriptions/me/                -> current plan + usage
```

Do not let a chat invent alternate paths (e.g. `/api/interview/` singular, or `/api/v1/...`).

---

## 6. CODING CONVENTIONS

- Python: snake_case, type hints on function signatures, Django REST `serializers.py` per app.
- TypeScript: camelCase, functional components only, no class components.
- Env vars: `OPENROUTER_API_KEY`, `DJANGO_SECRET_KEY`, `POSTGRES_*`, `JWT_SECRET` — names fixed, stored in `.env` (never committed; `.env.example` is committed).
- Every backend app gets `models.py`, `serializers.py`, `views.py`, `urls.py` — no exceptions, no shortcuts merging files.

---

## 7. BUILD PHASES (one per chat session)

- **Phase 0** — Repo + Docker skeleton (compose file, empty Django + Next.js apps booting, Postgres connected). *You're starting here.*
- **Phase 1** — Django models (Section 4) + migrations + Django admin registered for all models (use this to manually add 1 test company while building, before the custom admin panel exists).
- **Phase 2** — JWT auth: register/login/refresh endpoints + custom User model.
- **Phase 3** — Companies/Roles/Rounds/Questions read API (`/api/companies/`) + seed script with 2-3 real companies for testing.
- **Phase 4** — OpenRouter client (`openrouter_client.py`) + interview chat engine (`/start/`, `/chat/`, `/end/`) using `openai/gpt-4o-mini`, text only.
- **Phase 5** — Next.js auth pages + dashboard (company/role/round picker) wired to the real API.
- **Phase 6** — Text interview UI (`/interview/[roundId]`) + feedback page (`/feedback/[sessionId]`).
- **Phase 7** — Subscription limits (free=2/month) + Razorpay checkout for ₹499/month plan.
- **Phase 8** — Voice: Web Speech API or Whisper STT + TTS, added on top of the already-working text engine.
- **Phase 9** — Custom admin panel UI (`/admin` in Next.js) — by this point you've been using Django's built-in admin to manage data, so this is a nice-to-have wrapper.
- **Phase 10** — Polish, deploy (Render/Railway/VPS), README.

---

## 8. HARD RULES — DO NOT

- Do NOT change the tech stack, folder structure, model names, or API paths between chats.
- Do NOT add voice/speech before Phase 8.
- Do NOT invent OpenRouter model slugs — verify at openrouter.ai/models.
- Do NOT skip writing/updating `STATE.md` at the end of a session.
- Do NOT let a chat "simplify" the DB schema by renaming fields — downstream phases depend on exact names.

---

## 9. SESSION TEMPLATES

### Session Starter (paste at start of every new chat)
```
Here is the frozen spec for my project. Do not deviate from it.
[paste this entire PROJECT_MASTER_SPEC.md]

Current STATE.md:
[paste contents of STATE.md from repo]

Relevant existing files for this session (paste any files this phase will touch):
[paste file contents, or say "none yet, starting fresh on Phase X"]

Task for this session: Build PHASE <N> only, as defined in Section 7. Do not start other phases.
```

### Session Closer (paste at end of every session, before closing the chat)
```
Before we end: 
1. Give me the final, complete contents of every file you changed or created this session (full files, not diffs).
2. Update STATE.md: what's done, what's next, any decisions/deviations made and why.
3. Give me the exact git commands to commit and push these changes.
```

