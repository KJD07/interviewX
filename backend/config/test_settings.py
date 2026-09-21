"""SQLite settings for running tests without Docker/Postgres."""

from .settings import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

import os

os.environ.setdefault("INTERVIEW_SCORING_SYNC", "true")
