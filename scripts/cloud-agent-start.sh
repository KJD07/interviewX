#!/usr/bin/env bash
# Per-boot startup: ensure Postgres is running and ready.
set -euo pipefail

cd /workspace

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

if ! pg_isready -q 2>/dev/null; then
  sudo service postgresql start
  for _ in $(seq 1 30); do
    pg_isready -q 2>/dev/null && break
    sleep 1
  done
fi

if ! pg_isready -q; then
  echo "PostgreSQL failed to start" >&2
  exit 1
fi
