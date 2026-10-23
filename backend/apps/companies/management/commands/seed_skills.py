"""
Seed skill-based practice entries (Company rows with kind="skill") from the
curated bank in apps/companies/skill_bank.py — skills, rounds and
hand-written questions with ideal answers. Idempotent: only what's missing
is created. (Migration 0010_seed_skill_bank runs the same sync on deploy.)

USAGE
-----
Sync the curated bank (fast, no AI calls):

    python manage.py seed_skills

Also source extra real questions via AI for every round:

    python manage.py seed_skills --with-questions

Only AI-source specific skills by name (case-insensitive substring match):

    python manage.py seed_skills --with-questions --only React Python

EDITING THE DATA
----------------
Add skills/rounds/questions to SKILLS in apps/companies/skill_bank.py.
"""

from __future__ import annotations

import time

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.companies.models import Company, InterviewQuestion, Role, Round
from apps.companies.skill_bank import ROLE_TITLE, SKILLS, sync_skill_bank
from core.question_sourcing import QuestionSourcingError, source_questions_for_round
from core.read_cache import invalidate_company_catalog_cache


class Command(BaseCommand):
    help = "Seed skill-based practice entries, optionally AI-sourcing real questions per round."

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
            help="Only process skills whose name contains one of these substrings (case-insensitive).",
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=1.0,
            help="Seconds to sleep between AI sourcing calls. Default 1.0.",
        )

    def handle(self, *args, **options):
        with_questions = options["with_questions"]
        refresh_questions = options["refresh_questions"]
        only = [s.lower() for s in options["only"]] if options["only"] else None
        sleep_seconds = options["sleep"]

        counts = sync_skill_bank(Company, Role, Round, InterviewQuestion)
        self.stdout.write(self.style.SUCCESS(
            f"Skill bank synced: {counts['skills']} skills, {counts['rounds']} rounds, "
            f"{counts['questions']} questions created."
        ))
        invalidate_company_catalog_cache()
        if not with_questions:
            return

        skills_data = SKILLS
        if only:
            skills_data = [s for s in SKILLS if any(sub in s["name"].lower() for sub in only)]
            if not skills_data:
                raise CommandError(f"No skills in the bank matched --only {options['only']}")

        total_rounds_sourced = 0
        total_questions_created = 0

        for skill_data in skills_data:
            skill = Company.objects.get(name=skill_data["name"], kind=Company.Kind.SKILL, organization=None)
            role = Role.objects.get(company=skill, title=ROLE_TITLE)
            self.stdout.write(self.style.SUCCESS(f"Skill: {skill.name} [{skill.category}]"))
            for round_title, _, _ in skill_data["rounds"]:
                round_obj = Round.objects.get(role=role, title=round_title)
                self.stdout.write(f"    Round: {round_obj.title}")
                has_ai_questions = round_obj.questions.filter(generated_by_ai=True).exists()
                if has_ai_questions and not refresh_questions:
                    self.stdout.write("      Skipping (already has AI questions, use --refresh-questions to redo).")
                    continue

                self.stdout.write("      Sourcing questions via AI...")
                try:
                    sourced = source_questions_for_round(
                        company_name=skill.name,
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
                self.stdout.write(self.style.SUCCESS(f"      Sourced {len(sourced)} questions."))
                time.sleep(sleep_seconds)

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. Rounds sourced: {total_rounds_sourced}, questions created: {total_questions_created}."
            )
        )
        invalidate_company_catalog_cache()
