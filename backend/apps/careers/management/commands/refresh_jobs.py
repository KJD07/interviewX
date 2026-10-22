from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.careers import feeds
from apps.careers.models import JobFeedState


class Command(BaseCommand):
    help = "Run a full live-jobs sweep now (company boards + aggregator feeds), ignoring the 5-hour window."

    def handle(self, *args, **opts):
        JobFeedState.objects.update_or_create(pk=1, defaults={"last_refreshed_at": timezone.now()})
        feeds.run_sweep()
        state = JobFeedState.objects.get(pk=1)
        self.stdout.write(self.style.SUCCESS(
            f"{state.jobs_count} jobs from {state.companies_count} companies "
            f"({state.boards_ok} boards ok, {state.boards_failed} failed)"
        ))
