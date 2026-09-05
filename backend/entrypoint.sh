#!/usr/bin/env bash
# Run pending migrations before serving traffic so schema stays in sync
# after deploys (e.g. Razorpay → PayU column renames in migration 0006).
set -euo pipefail

python manage.py migrate --noinput
exec "$@"
