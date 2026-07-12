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
| POST | `/api/interviews/<id>/real-report/` | Optional form: report a real interview given elsewhere (paid plans only) |

## Subscriptions & payments (`/api/subscriptions/`)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/subscriptions/create-order/` | Creates a Razorpay order for a plan (pro/premium/max) |
| POST | `/api/subscriptions/verify-payment/` | Verifies payment, upgrades the plan for 30 days |
| POST | `/api/subscriptions/topup/create-order/` | Creates a Razorpay order for an interview top-up pack |
| POST | `/api/subscriptions/topup/verify-payment/` | Verifies payment, adds bonus interview credits |

Payment endpoints need real `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` values
in `.env` to actually complete a purchase — without them they fail with a
clean "Authentication failed" error, which is expected in local dev.
