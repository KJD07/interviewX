#!/usr/bin/env bash
# Per-boot startup: Postgres + Django (daphne) + Next.js dev server.
set -euo pipefail

cd /workspace

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=aiis
export POSTGRES_USER=aiis_user
export POSTGRES_PASSWORD=aiis_pass

if ! pg_isready -q 2>/dev/null; then
  sudo service postgresql start
  for _ in $(seq 1 30); do
    pg_isready -q 2>/dev/null && break
    sleep 1
  done
fi

# shellcheck disable=SC1091
source backend/.venv/bin/activate

cd backend
python manage.py migrate --noinput
daphne -b 0.0.0.0 -p 8000 config.asgi:application &
BACKEND_PID=$!

cd /workspace/frontend
npm run dev &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Keep start attached; exit if either service dies.
wait -n "$BACKEND_PID" "$FRONTEND_PID"
