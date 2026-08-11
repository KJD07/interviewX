"""
Bulk-import Company/Role/Round/InterviewQuestion rows from an uploaded
.xlsx or .csv spreadsheet (see the "Upload spreadsheet" admin page wired
up in admin.py).

Expected header row (exact match, case-sensitive):
    Company, Role, Round, Question Title, Difficulty, Category, Date, URL

A row is only imported if every one of those columns is non-empty after
stripping whitespace — this lets a raw scrape/export be uploaded as-is;
rows missing any field (e.g. the many rows with no Company) are silently
skipped and counted rather than erroring the whole import.

Difficulty and Date are validated as present but not stored — the current
InterviewQuestion model has no field for either. Category is used only to
infer question_type via keyword matching (see infer_question_type).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from django.db import transaction

from core.spreadsheet import SpreadsheetError, clean as _clean, read_rows, require_columns

from .models import Company, InterviewQuestion, Role, Round

REQUIRED_COLUMNS = [
    "Company",
    "Role",
    "Round",
    "Question Title",
    "Difficulty",
    "Category",
    "Date",
    "URL",
]

# New Companies created by this import have no tone_style in the sheet, but
# Company.tone_style is required — this mirrors seed_companies.py's casual
# default for lower-formality entries and can be edited per-company after.
DEFAULT_TONE_STYLE = "casual_friendly"


# File-level problem (bad header, unreadable/unsupported file) that aborts the
# whole import — distinct from per-row issues, which are collected in
# ImportResult instead of raised. Kept as an alias so the admin page's existing
# `except SpreadsheetImportError` still catches what the shared reader raises.
SpreadsheetImportError = SpreadsheetError


@dataclass
class ImportResult:
    rows_seen: int = 0
    rows_skipped: int = 0
    skipped_examples: list[str] = field(default_factory=list)
    companies_created: int = 0
    roles_created: int = 0
    rounds_created: int = 0
    questions_created: int = 0
    questions_skipped_duplicate: int = 0


def infer_question_type(category: str) -> str:
    """Best-effort guess of InterviewQuestion.question_type from the
    sheet's free-text Category column, mirroring the keyword-matching
    approach of Round.infer_round_type."""
    c = category.lower()
    if "system design" in c:
        return "system_design"
    if "coding" in c or "algorithm" in c:
        return "coding"
    if "behavioral" in c or "leadership" in c:
        return "behavioral"
    return "other"


def import_spreadsheet(uploaded_file) -> ImportResult:
    """Entry point: parse the uploaded file and seed Company/Role/Round/
    InterviewQuestion rows, skipping any row missing a required field and
    any question that's already been imported for its round."""
    rows = read_rows(uploaded_file)
    require_columns(rows, REQUIRED_COLUMNS)

    result = ImportResult()

    with transaction.atomic():
        # Cache lookups within this import so a sheet with thousands of rows
        # grouped by company/role/round only issues one get_or_create per
        # distinct combination instead of one per row.
        company_cache: dict[str, Company] = {}
        role_cache: dict[tuple[int, str], Role] = {}
        round_cache: dict[tuple[int, str], Round] = {}

        for raw_row in rows:
            result.rows_seen += 1
            cleaned = {col: _clean(raw_row.get(col)) for col in REQUIRED_COLUMNS}

            if not all(cleaned.values()):
                result.rows_skipped += 1
                if len(result.skipped_examples) < 20:
                    missing = [c for c, v in cleaned.items() if not v]
                    result.skipped_examples.append(f"row {result.rows_seen}: missing {', '.join(missing)}")
                continue

            company_key = cleaned["Company"].lower()
            company = company_cache.get(company_key)
            if company is None:
                company, created = Company.objects.get_or_create(
                    name=cleaned["Company"],
                    defaults={"tone_style": DEFAULT_TONE_STYLE},
                )
                if created:
                    result.companies_created += 1
                company_cache[company_key] = company

            role_key = (company.pk, cleaned["Role"].lower())
            role = role_cache.get(role_key)
            if role is None:
                role, created = Role.objects.get_or_create(company=company, title=cleaned["Role"])
                if created:
                    result.roles_created += 1
                role_cache[role_key] = role

            round_key = (role.pk, cleaned["Round"].lower())
            round_obj = round_cache.get(round_key)
            if round_obj is None:
                round_obj, created = Round.objects.get_or_create(
                    role=role,
                    title=cleaned["Round"],
                    defaults={"round_type": Round.infer_round_type(cleaned["Round"])},
                )
                if created:
                    result.rounds_created += 1
                round_cache[round_key] = round_obj

            question_text = cleaned["Question Title"]
            if InterviewQuestion.objects.filter(round=round_obj, question_text=question_text).exists():
                result.questions_skipped_duplicate += 1
                continue

            InterviewQuestion.objects.create(
                round=round_obj,
                question_text=question_text,
                question_type=infer_question_type(cleaned["Category"]),
                source_url=cleaned["URL"],
                generated_by_ai=False,
            )
            result.questions_created += 1

    return result
