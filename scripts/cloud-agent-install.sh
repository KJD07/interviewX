#!/usr/bin/env bash
# Idempotent Cloud Agent install: Postgres role/db, Python deps, Node deps, migrate, seed.
set -euo pipefail

cd /workspace

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

# Start Postgres if the cluster is down (install may run before start).
if ! pg_isready -q 2>/dev/null; then
  sudo service postgresql start
  for _ in $(seq 1 30); do
    pg_isready -q 2>/dev/null && break
    sleep 1
  done
fi

# Create app role/database (idempotent).
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='aiis_user'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER aiis_user WITH PASSWORD 'aiis_pass' CREATEDB;"
sudo -u postgres psql -c "ALTER USER aiis_user CREATEDB;" 2>/dev/null || true
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='aiis'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE aiis OWNER aiis_user;"

# Backend virtualenv + dependencies.
if [[ ! -d backend/.venv ]]; then
  uv python install 3.11
  uv venv backend/.venv --python 3.11
fi
# shellcheck disable=SC1091
source backend/.venv/bin/activate
uv pip install 'setuptools<81'
uv pip install -r backend/requirements.txt

# Point Django at local Postgres (not the docker-compose hostname).
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=aiis
export POSTGRES_USER=aiis_user
export POSTGRES_PASSWORD=aiis_pass

cd backend
python manage.py migrate --noinput
python manage.py seed_companies
python manage.py seed_skills
cd /workspace

# Frontend dependencies.
cd frontend
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
cd /workspace
