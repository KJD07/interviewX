#!/usr/bin/env sh
# Runs before every container command (it's the image ENTRYPOINT), so each
# redeploy brings the schema up to date before the app starts — including
# when docker-compose overrides the command.
#
#   RUN_MIGRATIONS=true  (default) wait for Postgres, then apply migrations
#   RUN_MIGRATIONS=wait  don't migrate; wait until another container has
#                        (the RQ scoring worker uses this)
#   RUN_MIGRATIONS=false skip entirely
#   COLLECTSTATIC=false  skip collectstatic (admin/DRF static files for whitenoise)
set -e

case "${RUN_MIGRATIONS:-true}" in
  true|1|yes) python manage.py migrate_on_deploy ;;
  wait) python manage.py migrate_on_deploy --wait-only ;;
esac

if [ "${COLLECTSTATIC:-true}" = "true" ]; then
  python manage.py collectstatic --noinput --verbosity 0
fi

# No command given -> the default server.
if [ "$#" -eq 0 ]; then
  set -- daphne -b 0.0.0.0 -p 8000 config.asgi:application
fi
exec "$@"
