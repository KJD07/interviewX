"""
Run by docker-entrypoint.sh on every container start, so a redeploy always
lands on an up-to-date schema.

  migrate_on_deploy              wait for Postgres, then `migrate` under a
                                 Postgres advisory lock (several containers
                                 starting at once migrate one at a time
                                 instead of racing on the same tables)
  migrate_on_deploy --wait-only  wait until another container has applied
                                 every migration (used by the RQ worker, so
                                 it never runs new code against an old schema)
"""

import time

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import OperationalError, connection
from django.db.migrations.executor import MigrationExecutor

# Arbitrary app-wide constant identifying the migration lock for pg_advisory_lock.
LOCK_KEY = 7_311_204_590


class Command(BaseCommand):
    help = "Wait for the database, then apply migrations under an advisory lock (or wait for them)."

    def add_arguments(self, parser):
        parser.add_argument("--wait-only", action="store_true",
                            help="Don't migrate; wait until no migrations are pending.")
        parser.add_argument("--timeout", type=int, default=300,
                            help="Seconds to wait for the database / for migrations (default 300).")

    def handle(self, *args, wait_only=False, timeout=300, **opts):
        deadline = time.monotonic() + timeout
        self._wait_for_db(deadline)
        if wait_only:
            self._wait_for_migrations(deadline)
            return
        with connection.cursor() as cur:
            cur.execute("SELECT pg_advisory_lock(%s)", [LOCK_KEY])
        try:
            call_command("migrate", interactive=False, verbosity=opts.get("verbosity", 1))
        finally:
            with connection.cursor() as cur:
                cur.execute("SELECT pg_advisory_unlock(%s)", [LOCK_KEY])

    def _wait_for_db(self, deadline):
        while True:
            try:
                connection.ensure_connection()
                return
            except OperationalError as exc:
                if time.monotonic() > deadline:
                    raise CommandError(f"Database not reachable: {exc}") from exc
                self.stdout.write("Waiting for the database…")
                connection.close()
                time.sleep(2)

    def _wait_for_migrations(self, deadline):
        while True:
            executor = MigrationExecutor(connection)
            pending = executor.migration_plan(executor.loader.graph.leaf_nodes())
            if not pending:
                self.stdout.write("Schema is up to date.")
                return
            if time.monotonic() > deadline:
                raise CommandError(f"{len(pending)} migration(s) still pending after waiting.")
            self.stdout.write(f"Waiting for {len(pending)} pending migration(s) to be applied…")
            time.sleep(3)
