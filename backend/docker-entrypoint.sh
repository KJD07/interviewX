#!/usr/bin/env sh
set -e

# Apply pending migrations on container start so API routes (e.g. partner dashboard)
# never 500 due to schema drift after a deploy.
python manage.py migrate --noinput

exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
