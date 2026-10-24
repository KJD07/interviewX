from pathlib import Path

from django.core.management.base import BaseCommand

from apps.careers import discovery


class Command(BaseCommand):
    help = ("Find companies' job boards (data/india_companies.json, or any JSON/.xlsx list) on the ATSs Live "
            "jobs can fetch, verify them, and add the new ones to data/job_boards.json — the 5-hourly sweep "
            "then fetches their listings.")

    def add_arguments(self, parser):
        parser.add_argument("--file", type=Path, default=discovery.COMPANIES_FILE,
                            help="JSON list of {company, careers_url?, slugs?, india_only?}, or an .xlsx with a Company column "
                                 "(default: data/india_companies.json)")
        parser.add_argument("--only", action="append", default=[], metavar="COMPANY",
                            help="Only these companies (repeatable, case-insensitive)")
        parser.add_argument("--no-probe", action="store_true", help="Don't guess board slugs from company names")
        parser.add_argument("--dry-run", action="store_true", help="Report what was found without writing the file")
        parser.add_argument("--workers", type=int, default=8)

    def handle(self, *args, **opts):
        companies = discovery.load_companies(opts["file"])
        if opts["only"]:
            wanted = {c.lower() for c in opts["only"]}
            companies = [c for c in companies if c["company"].lower() in wanted]
        self.stdout.write(f"Checking {len(companies)} companies…")
        results = discovery.discover(companies, probe=not opts["no_probe"], workers=opts["workers"])

        found = [b for r in results for b in r.found]
        skipped = sum(1 for r in results if r.skipped)
        for r in results:
            for b in r.found:
                self.stdout.write(self.style.SUCCESS(
                    f"  + {r.company}: {b['ats']}/{b['token']} — {b['india_jobs']}/{b['jobs']} India roles ({b['via']})"))
            if not r.found and opts["verbosity"] > 1:
                self.stdout.write(f"  - {r.company}: nothing new{' (' + '; '.join(r.notes) + ')' if r.notes else ''}")
        missed = sum(1 for r in results if not r.found and not r.skipped)
        if opts["dry_run"]:
            self.stdout.write(f"{len(found)} new boards found, {skipped} companies already listed, "
                              f"{missed} companies without one (dry run, file unchanged)")
            return
        added = discovery.add_to_boards_file(found)
        self.stdout.write(self.style.SUCCESS(
            f"Added {added} boards to {discovery.feeds.BOARDS_FILE.name}; {skipped} companies already listed, "
            f"{missed} without a board we can fetch. "
            "The next sweep picks them up (or run `manage.py refresh_jobs`)."))
