"""
Django settings for the AI Interview Simulator backend.
Phase 0: minimal boot — Postgres wired up, REST framework installed.
Apps under apps/ are registered now (empty) so later phases can drop in
models/serializers/views without touching settings again.
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-key-change-me")

# Fail-safe default: if DJANGO_DEBUG is missing entirely (e.g. a prod deploy
# with an incomplete .env), we come up in the SAFE state (DEBUG=False)
# rather than the leaky one. Local dev sets DJANGO_DEBUG=True explicitly via
# .env.example, so this doesn't change the local dev experience.
DEBUG = os.environ.get("DJANGO_DEBUG", "False") == "True"

if not DEBUG and SECRET_KEY == "dev-insecure-key-change-me":
    raise RuntimeError(
        "DJANGO_SECRET_KEY must be set to a real secret when DJANGO_DEBUG=False. "
        "Refusing to start with the default dev key in what looks like production."
    )

ALLOWED_HOSTS = os.environ.get(
    "DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,backend"
).split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    # local apps (Section 3 of spec — empty until their respective phases)
    "apps.accounts",
    "apps.companies",
    "apps.interviews",
    "apps.subscriptions",
    "apps.reviews",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "aiis"),
        "USER": os.environ.get("POSTGRES_USER", "aiis_user"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "aiis_pass"),
        "HOST": os.environ.get("POSTGRES_HOST", "db"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CRITICAL: must be set before the first migration ever runs
AUTH_USER_MODEL = "accounts.User"

# --- DRF / JWT (auth endpoints land in Phase 2 — config wired now) ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        # Global fallbacks for any endpoint that doesn't set its own scope.
        "anon": "60/min",
        "user": "120/min",
        # Tighter scope applied explicitly to auth endpoints (register,
        # verify-OTP, resend-OTP, login, google-auth) to block brute-force /
        # credential-stuffing / OTP-spam attacks.
        "auth": "10/min",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "SIGNING_KEY": os.environ.get("JWT_SECRET", SECRET_KEY),
}

# --- CORS (frontend runs on :3000 in dev) ---
# Comma-separated list via env for prod (e.g. https://interviewx.dev). Falls
# back to the local dev origins so nothing breaks for local `docker compose
# up`. Uses `or` rather than .get()'s default arg because Docker Compose's
# env_file loading sets an unfilled var as an actual empty string rather
# than leaving it unset — same gotcha documented for JWT_SECRET below.
CORS_ALLOWED_ORIGINS = (
    os.environ.get("CORS_ALLOWED_ORIGINS") or "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

# Needed for POST/PUT/etc. from the frontend origin to pass Django's CSRF
# checks in production (session/admin auth). Defaults to the CORS origins
# since in this app they're always the same frontend domain(s).
CSRF_TRUSTED_ORIGINS = (
    os.environ.get("CSRF_TRUSTED_ORIGINS") or ",".join(CORS_ALLOWED_ORIGINS)
).split(",")

# --- Production-only hardening ---
# Gated on DEBUG so local dev (plain http://localhost) keeps working, while
# a real deploy (DEBUG=False) gets HTTPS enforcement, secure cookies, and
# HSTS out of the box instead of relying on someone remembering to add them.
if not DEBUG:
    SECURE_SSL_REDIRECT = (os.environ.get("DJANGO_SECURE_SSL_REDIRECT") or "True") == "True"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    # Set when running behind a proxy/load balancer that terminates TLS
    # (Render, Railway, nginx, etc.) so Django knows the original request
    # was HTTPS even though it reaches this process over plain HTTP.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# --- OpenRouter (used starting Phase 4) ---
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

# --- Razorpay (Phase 8) ---
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")

# --- Email (OTP verification) ---
# Defaults to printing emails to the console so OTPs are visible in
# `docker compose logs -f backend` during local dev with zero setup.
# Set EMAIL_HOST/EMAIL_HOST_USER/EMAIL_HOST_PASSWORD in .env to send real
# email (e.g. Gmail SMTP, SendGrid, Postmark, etc.) in production.
if os.environ.get("EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ.get("EMAIL_HOST")
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
    EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True") == "True"
    EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "InterviewX <no-reply@interviewx.local>")

# --- Google Sign-In ---
# The OAuth "Web application" client ID from Google Cloud Console. The
# frontend uses this same ID to render the Google button; the backend uses
# it to verify that ID tokens were actually issued for this app.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")