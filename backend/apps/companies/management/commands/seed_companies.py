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
        "is_free": True,
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
        "is_free": True,
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
        "is_free": True,
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
    # -----------------------------------------------------------------
    # New batch — 17 companies (Google/Amazon/Microsoft excluded, already above).
    # -----------------------------------------------------------------
    {
        "name": "Apple",
        "tone_style": "formal_strict",
        "description": "Secretive culture, deep technical rounds with strong emphasis on past project depth and craftsmanship.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Phone Screen", "Onsite Coding Round", "Team Fit / Deep Dive Round"],
            },
        ],
    },
    {
        "name": "Meta",
        "tone_style": "formal_strict",
        "description": "Fast-paced, DSA + system design heavy, with a strong focus on behavioral questions tied to Meta's core values.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Coding Interview 1", "Coding Interview 2", "System Design", "Behavioral (Values)"],
            },
        ],
    },
    {
        "name": "NVIDIA",
        "tone_style": "formal_strict",
        "description": "Strong CS fundamentals, low-level systems and hardware-aware questions, deep technical panels.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Online Assessment", "Technical Screen", "Technical Panel Round 1", "Technical Panel Round 2 (System Design)"],
            },
        ],
    },
    {
        "name": "GitLab",
        "tone_style": "casual_friendly",
        "description": "Fully remote, async-first culture; interviews emphasize collaboration, writing, and transparency values.",
        "is_free": True,
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Interview", "Values Interview", "Hiring Manager Round"],
            },
        ],
    },
    {
        "name": "Airbnb",
        "tone_style": "casual_friendly",
        "description": "Emphasis on 'belong anywhere' core values alongside solid DSA and system design rounds.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Phone Screen", "Onsite Coding", "System Design", "Values Interview"],
            },
        ],
    },
    {
        "name": "Canva",
        "tone_style": "casual_friendly",
        "description": "Product-minded engineering culture, practical coding rounds and strong focus on collaboration.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Interview", "System Design", "Values & Culture Round"],
            },
        ],
    },
    {
        "name": "Reddit",
        "tone_style": "casual_friendly",
        "description": "Pragmatic engineering interviews focused on real-world problem solving and product sense.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Phone Screen", "Onsite Coding Round", "System Design", "Hiring Manager Round"],
            },
        ],
    },
    {
        "name": "Anthropic",
        "tone_style": "formal_strict",
        "description": "Research-driven culture; interviews probe deep CS fundamentals, ML/LLM familiarity, and safety-mindedness.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Screen", "Coding Round", "System Design", "Behavioral / Values Fit"],
            },
        ],
    },
    {
        "name": "Dropbox",
        "tone_style": "casual_friendly",
        "description": "Infrastructure-heavy engineering interviews with focus on distributed systems and practical coding.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Phone Screen", "Onsite Coding", "System Design", "Behavioral Round"],
            },
        ],
    },
    {
        "name": "OpenAI",
        "tone_style": "formal_strict",
        "description": "High technical bar; strong ML/LLM and systems fundamentals expected alongside classic DSA.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Screen", "Coding Round 1", "Coding Round 2", "System Design", "Behavioral Round"],
            },
        ],
    },
    {
        "name": "Stripe",
        "tone_style": "formal_strict",
        "description": "Known for a rigorous, well-structured interview loop with a strong emphasis on code quality and correctness.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Screen", "Onsite Coding Round", "System Design", "Behavioral / Values Round"],
            },
        ],
    },
    {
        "name": "Spotify",
        "tone_style": "casual_friendly",
        "description": "Squad-based engineering culture; interviews mix coding, system design, and team-fit conversations.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Phone Screen", "Onsite Coding", "System Design", "Team Fit Round"],
            },
        ],
    },
    {
        "name": "Pinterest",
        "tone_style": "casual_friendly",
        "description": "Product-focused engineering interviews with solid DSA, system design, and values-based behavioral rounds.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Phone Screen", "Onsite Coding Round", "System Design", "Behavioral Round"],
            },
        ],
    },
    {
        "name": "TikTok",
        "tone_style": "formal_strict",
        "description": "Fast-paced, multiple back-to-back technical rounds with strong DSA and system design emphasis.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Online Assessment", "Technical Round 1", "Technical Round 2", "System Design", "HR Round"],
            },
        ],
    },
    {
        "name": "Oracle",
        "tone_style": "formal_strict",
        "description": "Traditional enterprise interview process, CS fundamentals and DSA heavy with a formal panel round.",
        "is_free": True,
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Online Assessment", "Technical Round 1", "Technical Round 2", "HR Round"],
            },
        ],
    },
    {
        "name": "ServiceNow",
        "tone_style": "formal_strict",
        "description": "Enterprise SaaS platform; interviews balance DSA, practical system design, and behavioral rounds.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Online Assessment", "Technical Round 1", "Technical Round 2 (System Design)", "Managerial / HR Round"],
            },
        ],
    },
    {
        "name": "Datadog",
        "tone_style": "casual_friendly",
        "description": "Observability platform; interviews emphasize distributed systems, debugging skills, and practical coding.",
        "roles": [
            {
                "title": "Software Engineer",
                "rounds": ["Recruiter Screen", "Technical Phone Screen", "Onsite Coding Round", "System Design", "Behavioral Round"],
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
                    "is_free": company_data.get("is_free", False),
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
                        defaults={
                            "order": order,
                            "round_type": Round.infer_round_type(round_title),
                        },
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