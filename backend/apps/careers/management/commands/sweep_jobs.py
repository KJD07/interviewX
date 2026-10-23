import logging
import time
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import close_old_connections

from apps.careers import feeds

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Long-running live-jobs sweeper (the job_sweeper compose service): runs a sweep "
        "whenever the last one is JOB_REFRESH_HOURS old, outside the web process."
    )

    def add_arguments(self, parser):
        parser.add_argument("--poll", type=int, default=600, help="Seconds between staleness checks.")
        parser.add_argument("--once", action="store_true", help="Check once, sweep if due, and exit.")

    def handle(self, *args, **opts):
        interval = timedelta(hours=settings.JOB_REFRESH_HOURS)
        while True:
            try:
                if feeds.claim_sweep(interval):
                    self.stdout.write("job sweep started")
                    feeds.run_sweep()
                    self.stdout.write("job sweep finished")
            except Exception:  # one bad sweep (or a DB blip) must not kill the service
                logger.exception("job sweep failed")
            if opts["once"]:
                return
            close_old_connections()  # don't hold (or reuse a dead) DB connection while idle
            time.sleep(opts["poll"])
