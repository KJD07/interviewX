"""
Bulk-seed real companies, roles, and rounds, and optionally trigger the
AI question-sourcing pipeline (core.question_sourcing) for each round.

USAGE
-----
Just create the Company/Role/Round skeleton (fast, no AI calls):

    python manage.py seed_companies

Also source real questions via AI for every round just created
(slow — one research + one extraction LLM call per round):

    python manage.py seed_companies --with-questions

Only seed specific companies by name (case-insensitive substring match
against the DATA list below), useful for retrying a failed one:

    python manage.py seed_companies --with-questions --only Google Amazon

Skip companies/roles/rounds that already exist (default) vs force
re-creating rounds' AI questions even if they already have some:

    python manage.py seed_companies --with-questions --refresh-questions

EDITING THE DATA
----------------
Add/remove entries in the DATA list below. Each company has a list of
roles, and each role has a list of round titles. tone_style and
description are used by the interview engine's system prompt, so keep
tone_style short (e.g. "formal_strict", "casual_friendly").
"""

from __future__ import annotations

import time

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.companies.models import Company, InterviewQuestion, Role, Round
from core.question_sourcing import QuestionSourcingError, source_questions_for_round

# ---------------------------------------------------------------------------
# Edit this list to add more real companies / roles / rounds.
# ---------------------------------------------------------------------------
DATA = [
    {
        "name": "Google",
        "tone_style": "formal_strict",
        "description": "Big tech, strong DSA + system design bar, Googleyness behavioral round.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Online Assessment", "Technical Round 1 (DSA)", "Technical Round 2 (System Design)", "Googleyness & Leadership"],
            },
        ],
    },
    {
        "name": "Amazon",
        "tone_style": "formal_strict",
        "description": "Leadership Principles are central to every round, including technical ones.",
        "roles": [
            {
                "title": "SDE-1",
                "rounds": ["Online Assessment", "Technical Round 1", "Technical Round 2", "Bar Raiser"],
            },
        ],
    },
    {
        "name": "Microsoft",
        "tone_style": "formal_strict",
        "description": "Mix of DSA, CS fundamentals, and design rounds.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Online Assessment", "Technical Round 1", "Technical Round 2 (System Design)", "HR Round"],
            },
        ],
    },
    {
        "name": "TCS",
        "tone_style": "casual_friendly",
        "description": "Service-based, focuses on fundamentals, aptitude, and communication.",
        "roles": [
            {
                "title": "Ninja / Digital",
                "rounds": ["Aptitude & Coding Test", "Technical Interview", "HR Interview"],
            },
        ],
    },
    {
        "name": "Infosys",
        "tone_style": "casual_friendly",
        "description": "Service-based, focuses on fundamentals, aptitude, and communication.",
        "roles": [
            {
                "title": "Systems Engineer",
                "rounds": ["Aptitude & Coding Test", "Technical Interview", "HR Interview"],
            },
        ],
    },
    {
        "name": "Flipkart",
        "tone_style": "casual_friendly",
        "description": "Indian e-commerce giant, DSA-heavy with product-thinking rounds.",
        "roles": [
            {
                "title": "SDE-1",
                "rounds": ["Online Assessment", "Technical Round 1", "Technical Round 2", "Hiring Manager Round"],
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Seed real companies/roles/rounds, optionally AI-sourcing real interview questions for each round."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-questions",
            action="store_true",
            help="After creating each round, call the AI question-sourcing pipeline for it.",
        )
        parser.add_argument(
            "--refresh-questions",
            action="store_true",
            help="With --with-questions: re-source questions even for rounds that already have AI-generated ones.",
        )
        parser.add_argument(
            "--only",
            nargs="*",
            default=None,
            help="Only process companies whose name contains one of these substrings (case-insensitive).",
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=1.0,
            help="Seconds to sleep between AI sourcing calls, to be polite to the API. Default 1.0.",
        )

    def handle(self, *args, **options):
        with_questions = options["with_questions"]
        refresh_questions = options["refresh_questions"]
        only = [s.lower() for s in options["only"]] if options["only"] else None
        sleep_seconds = options["sleep"]

        companies_data = DATA
        if only:
            companies_data = [
                c for c in DATA if any(s in c["name"].lower() for s in only)
            ]
            if not companies_data:
                raise CommandError(f"No companies in DATA matched --only {options['only']}")

        total_rounds_sourced = 0
        total_questions_created = 0

        for company_data in companies_data:
            company, created = Company.objects.get_or_create(
                name=company_data["name"],
                defaults={
                    "tone_style": company_data["tone_style"],
                    "description": company_data["description"],
                },
            )
            self.stdout.write(
                self.style.SUCCESS(f"{'Created' if created else 'Found'} company: {company.name}")
            )

            for role_data in company_data["roles"]:
                role, r_created = Role.objects.get_or_create(
                    company=company,
                    title=role_data["title"],
                )
                self.stdout.write(
                    f"  {'Created' if r_created else 'Found'} role: {role.title}"
                )

                for order, round_title in enumerate(role_data["rounds"]):
                    round_obj, rd_created = Round.objects.get_or_create(
                        role=role,
                        title=round_title,
                        defaults={"order": order},
                    )
                    self.stdout.write(
                        f"    {'Created' if rd_created else 'Found'} round: {round_obj.title}"
                    )

                    if not with_questions:
                        continue

                    has_ai_questions = round_obj.questions.filter(generated_by_ai=True).exists()
                    if has_ai_questions and not refresh_questions:
                        self.stdout.write("      Skipping (already has AI questions, use --refresh-questions to redo).")
                        continue

                    self.stdout.write("      Sourcing real questions via AI...")
                    try:
                        sourced = source_questions_for_round(
                            company_name=company.name,
                            role_title=role.title,
                            round_title=round_obj.title,
                        )
                    except QuestionSourcingError as exc:
                        self.stderr.write(self.style.ERROR(f"      Failed: {exc}"))
                        time.sleep(sleep_seconds)
                        continue

                    with transaction.atomic():
                        round_obj.questions.filter(generated_by_ai=True).delete()
                        InterviewQuestion.objects.bulk_create(
                            [
                                InterviewQuestion(
                                    round=round_obj,
                                    question_text=q.question_text,
                                    question_type=q.question_type,
                                    ideal_answer=q.ideal_answer,
                                    source_url=q.source_url,
                                    generated_by_ai=True,
                                )
                                for q in sourced
                            ]
                        )

                    total_rounds_sourced += 1
                    total_questions_created += len(sourced)
                    self.stdout.write(
                        self.style.SUCCESS(f"      Sourced {len(sourced)} questions.")
                    )
                    time.sleep(sleep_seconds)

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. Rounds sourced: {total_rounds_sourced}, questions created: {total_questions_created}."
            )
        )