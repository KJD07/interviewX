# API Documentation

All endpoints below are implemented. Everything except register/login/refresh
requires a JWT access token in the `Authorization: Bearer <token>` header.

## Auth (`/api/auth/`)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register/` | Creates an unverified account, emails a 6-digit OTP |
| POST | `/api/auth/verify-email/` | Confirms the OTP, returns tokens |
| POST | `/api/auth/resend-otp/` | Sends a new OTP code |
| POST | `/api/auth/login/` | Email + password, returns tokens |
| POST | `/api/auth/google/` | Google Sign-In via ID token, returns tokens |
| GET | `/api/auth/me/` | Current user profile (plan, usage, verification status) |
| POST | `/api/auth/token/refresh/` | Exchanges a refresh token for a new access token |

## Companies & skills (`/api/companies/`)

Skills use the same endpoints with `?kind=skill` — they're stored as
`Company` rows with `kind="skill"` instead of `kind="company"`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/companies/` | List companies. Add `?kind=skill` for the skills list |
| GET | `/api/companies/<id>/` | Company detail, nested roles → rounds → questions |
| GET | `/api/companies/<id>/roles/` | Roles for a company |
| GET | `/api/companies/<id>/roles/<id>/rounds/` | Rounds for a role |
| GET | `/api/companies/<id>/roles/<id>/rounds/<id>/` | Single round with questions |
| POST | `/api/companies/<id>/roles/<id>/rounds/<id>/generate-questions/` | Admin only. Sources real interview questions from the web via AI |

## Interviews (`/api/interviews/`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/interviews/` | List the logged-in user's sessions |
| POST | `/api/interviews/` | Create a session directly (existing CRUD path) |
| GET | `/api/interviews/progress/` | Score history / analytics for the progress page |
| GET | `/api/interviews/<id>/` | Session detail |
| PATCH | `/api/interviews/<id>/` | Update a session |
| POST | `/api/interviews/start/` | Start an interview for a round (checks plan/top-up limit) |
| POST | `/api/interviews/<id>/chat/` | Send an answer, get the AI's next reply |
| POST | `/api/interviews/<id>/end/` | End the interview, get scores + feedback |
| GET | `/api/interviews/real-reports/` | List the logged-in user's own submitted real-interview reports (any plan) |
| POST | `/api/interviews/real-reports/` | Submit a report of a real interview given elsewhere (paid plans only); optional `session` field, approved reports grant 5 bonus interviews |

## Subscriptions & payments (`/api/subscriptions/`)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/subscriptions/create-order/` | Creates a PayU transaction for a plan (pro/premium/max); returns hosted-checkout form fields |
| POST | `/api/subscriptions/topup/create-order/` | Creates a PayU transaction for an interview top-up pack |
| POST | `/api/subscriptions/payu/success/` | PayU success callback (surl) — verifies hash and upgrades plan / credits |
| POST | `/api/subscriptions/payu/failure/` | PayU failure callback (furl) |

Payment endpoints need real `PAYU_MERCHANT_KEY` / `PAYU_MERCHANT_SALT` values
in `.env`, plus a reachable `BACKEND_URL` for PayU callbacks, to complete a
purchase end-to-end. Without them create-order returns 503 or callbacks fail,
which is expected in local dev without a tunnel.
