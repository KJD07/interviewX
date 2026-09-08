"""SQLite settings for local demos without Docker/Postgres."""

from pathlib import Path

from .settings import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": Path(BASE_DIR) / "demo.sqlite3",  # noqa: F405
    }
}
