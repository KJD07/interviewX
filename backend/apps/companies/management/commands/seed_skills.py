"""
Bulk-seed skill-based practice entries (Company rows with kind="skill"),
grouped by category, and optionally trigger the AI question-sourcing
pipeline for each round — same mechanism used for real companies.

USAGE
-----
Just create the Skill/Role/Round skeleton (fast, no AI calls):

    python manage.py seed_skills

Also source real questions via AI for every round just created:

    python manage.py seed_skills --with-questions

Only seed specific skills by name (case-insensitive substring match):

    python manage.py seed_skills --with-questions --only React Python

EDITING THE DATA
----------------
Add/remove entries in the DATA list below. Each skill has one or more
"roles" (difficulty tracks, e.g. Beginner/Intermediate/Advanced), and each
role has a list of round titles. `category` groups skills in the frontend
Skills section (e.g. "Frontend", "Backend", "Databases", "DevOps").
"""

from __future__ import annotations

import time

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.companies.models import Company, InterviewQuestion, Role, Round
from core.question_sourcing import QuestionSourcingError, source_questions_for_round

# ---------------------------------------------------------------------------
# Edit this list to add more skills.
# ---------------------------------------------------------------------------
DATA = [
    {
        "name": "React",
        "category": "Frontend",
        "tone_style": "casual_friendly",
        "description": "Component architecture, hooks, state management, and performance.",
        "roles": [
            {
                "title": "Intermediate",
                "rounds": ["Core Concepts", "Hooks & State Management", "Performance & Debugging"],
            },
        ],
    },
    {
        "name": "JavaScript",
        "category": "Frontend",
        "tone_style": "formal_strict",
        "description": "Core language fundamentals, async patterns, and the event loop.",
        "roles": [
            {
                "title": "Intermediate",
                "rounds": ["Fundamentals", "Async & Promises", "Advanced Concepts"],
            },
        ],
    },
    {
        "name": "Python",
        "category": "Backend",
        "tone_style": "casual_friendly",
        "description": "Language fundamentals, OOP, and common backend patterns.",
        "roles": [
            {
                "title": "Intermediate",
                "rounds": ["Fundamentals", "OOP & Design", "Backend Patterns"],
            },
        ],
    },
    {
        "name": "Django",
        "category": "Backend",
        "tone_style": "formal_strict",
        "description": "ORM, views/serializers, auth, and REST API design.",
        "roles": [
            {
                "title": "Intermediate",
                "rounds": ["ORM & Models", "Views, Serializers & Auth", "REST API Design"],
            },
        ],
    },
    {
        "name": "Node.js",
        "category": "Backend",
        "tone_style": "casual_friendly",
        "description": "Event loop, Express, middleware, and API design.",
        "roles": [
            {
                "title": "Intermediate",
                "rounds": ["Core Concepts & Event Loop", "Express & Middleware", "API Design"],
            },
        ],
    },
    {
        "name": "SQL",
        "category": "Databases",
        "tone_style": "formal_strict",
        "description": "Joins, indexing, query optimization, and schema design.",
        "roles": [
            {
                "title": "Intermediate",
                "rounds": ["Queries & Joins", "Indexing & Optimization", "Schema Design"],
            },
        ],
    },
    {
        "name": "System Design",
        "category": "Architecture",
        "tone_style": "aggressive",
        "description": "Scalability, tradeoffs, caching, and distributed systems basics.",
        "roles": [
            {
                "title": "Intermediate",
                "rounds": ["Fundamentals & Tradeoffs", "Scalability & Caching", "Case Study Deep Dive"],
            },
        ],
    },
    {
        "name": "Docker",
        "category": "DevOps",
        "tone_style": "casual_friendly",
        "description": "Images, containers, Compose, and deployment basics.",
        "roles": [
            {
                "title": "Intermediate",
                "rounds": ["Core Concepts", "Compose & Networking", "Deployment Practices"],
            },
        ],
    },
]


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

        skills_data = DATA
        if only:
            skills_data = [s for s in DATA if any(sub in s["name"].lower() for sub in only)]
            if not skills_data:
                raise CommandError(f"No skills in DATA matched --only {options['only']}")

        total_rounds_sourced = 0
        total_questions_created = 0

        for skill_data in skills_data:
            skill, created = Company.objects.get_or_create(
                name=skill_data["name"],
                kind=Company.Kind.SKILL,
                defaults={
                    "tone_style": skill_data["tone_style"],
                    "description": skill_data["description"],
                    "category": skill_data.get("category", ""),
                },
            )
            self.stdout.write(
                self.style.SUCCESS(f"{'Created' if created else 'Found'} skill: {skill.name} [{skill.category}]")
            )

            for role_data in skill_data["roles"]:
                role, r_created = Role.objects.get_or_create(
                    company=skill,
                    title=role_data["title"],
                )
                self.stdout.write(f"  {'Created' if r_created else 'Found'} role: {role.title}")

                for order, round_title in enumerate(role_data["rounds"]):
                    round_obj, rd_created = Round.objects.get_or_create(
                        role=role,
                        title=round_title,
                        defaults={
                            "order": order,
                            "round_type": Round.infer_round_type(round_title),
                        },
                    )
                    self.stdout.write(f"    {'Created' if rd_created else 'Found'} round: {round_obj.title}")

                    if not with_questions:
                        continue

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
