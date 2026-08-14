"""
Bulk-import an org's own Role/Round/InterviewQuestion rows from a self-serve
CSV/XLSX/JSON upload (apps.enterprise dashboard), or the same shape uploaded
by an admin as a fallback. Mirrors apps.companies.imports.import_spreadsheet's
row-skipping/counting approach, but scoped to one Organization's private
Company row (kind='enterprise') instead of the public companies dataset, and
accepts JSON in addition to CSV/XLSX since business customers commonly export
their question bank from an ATS as JSON rather than a spreadsheet.

Expected columns (CSV/XLSX header, or equivalent JSON keys):
    Role, Round, Round Type, Question Text, Question Type, Ideal Answer
A row is skipped (and counted) if Role, Round, or Question Text is empty.
Round Type / Question Type fall back to a best-effort guess (reusing
Round.infer_round_type) rather than rejecting the row, since these are the
columns a business customer's export is most likely to get wrong/omit.
"""

from __future__ import annotations

import json as json_module
from dataclasses import dataclass, field

from django.db import transaction

from apps.companies.models import Company, InterviewQuestion, Role, Round
from core.spreadsheet import SpreadsheetError, clean as _clean, read_rows, require_columns

REQUIRED_COLUMNS = ["Role", "Round", "Round Type", "Question Text", "Question Type", "Ideal Answer"]

QUESTION_TYPE_VALUES = {choice[0] for choice in InterviewQuestion.QUESTION_TYPES}
ROUND_TYPE_VALUES = set(Round.RoundType.values)

# Alias so callers can catch one exception type regardless of whether the
# failure came from the shared CSV/XLSX reader or our own JSON parsing.
OrgImportError = SpreadsheetError


@dataclass
class OrgImportResult:
    rows_seen: int = 0
    rows_skipped: int = 0
    skipped_examples: list[str] = field(default_factory=list)
    roles_created: int = 0
    rounds_created: int = 0
    questions_created: int = 0
    questions_skipped_duplicate: int = 0


def get_or_create_org_company(organization) -> Company:
    """Every org gets exactly one private Company row acting as the
    container for its Role/Round/InterviewQuestion question bank."""
    company, _ = Company.objects.get_or_create(
        organization=organization,
        kind=Company.Kind.ENTERPRISE,
        defaults={"name": organization.name, "tone_style": "formal_strict"},
    )
    return company


def _rows_from_json(uploaded_file) -> list[dict]:
    raw = uploaded_file.read()
    text = raw.decode("utf-8-sig") if isinstance(raw, bytes) else raw
    try:
        data = json_module.loads(text)
    except ValueError as exc:
        raise OrgImportError(f"Invalid JSON: {exc}") from exc
    if not isinstance(data, list):
        raise OrgImportError("Expected a JSON array of question objects.")
    # Normalize snake_case JSON keys to the same header names read_rows()
    # produces for CSV/XLSX, so the rest of the importer is format-agnostic.
    key_map = {
        "role": "Role",
        "round": "Round",
        "round_type": "Round Type",
        "question_text": "Question Text",
        "question_type": "Question Type",
        "ideal_answer": "Ideal Answer",
    }
    return [{key_map.get(k, k): v for k, v in row.items()} for row in data]


def import_org_questions(organization, uploaded_file) -> OrgImportResult:
    name = (uploaded_file.name or "").lower()
    rows = _rows_from_json(uploaded_file) if name.endswith(".json") else read_rows(uploaded_file)
    require_columns(rows, REQUIRED_COLUMNS)

    company = get_or_create_org_company(organization)
    result = OrgImportResult()

    with transaction.atomic():
        # Cache within this import so a bank with hundreds of questions
        # grouped by role/round only issues one get_or_create per distinct
        # combination instead of one per row (same approach as
        # apps.companies.imports.import_spreadsheet).
        role_cache: dict[str, Role] = {}
        round_cache: dict[tuple[int, str], Round] = {}

        for raw_row in rows:
            result.rows_seen += 1
            cleaned = {col: _clean(raw_row.get(col)) for col in REQUIRED_COLUMNS}

            if not cleaned["Role"] or not cleaned["Round"] or not cleaned["Question Text"]:
                result.rows_skipped += 1
                if len(result.skipped_examples) < 20:
                    result.skipped_examples.append(
                        f"row {result.rows_seen}: missing Role/Round/Question Text"
                    )
                continue

            role_key = cleaned["Role"].lower()
            role = role_cache.get(role_key)
            if role is None:
                role, created = Role.objects.get_or_create(company=company, title=cleaned["Role"])
                if created:
                    result.roles_created += 1
                role_cache[role_key] = role

            round_type = cleaned["Round Type"].lower().replace(" ", "_")
            if round_type not in ROUND_TYPE_VALUES:
                round_type = Round.infer_round_type(cleaned["Round"])

            round_key = (role.pk, cleaned["Round"].lower())
            round_obj = round_cache.get(round_key)
            if round_obj is None:
                round_obj, created = Round.objects.get_or_create(
                    role=role, title=cleaned["Round"], defaults={"round_type": round_type}
                )
                if created:
                    result.rounds_created += 1
                round_cache[round_key] = round_obj

            question_type = cleaned["Question Type"].lower().replace(" ", "_")
            if question_type not in QUESTION_TYPE_VALUES:
                question_type = "other"

            question_text = cleaned["Question Text"]
            if InterviewQuestion.objects.filter(round=round_obj, question_text=question_text).exists():
                result.questions_skipped_duplicate += 1
                continue

            InterviewQuestion.objects.create(
                round=round_obj,
                question_text=question_text,
                question_type=question_type,
                ideal_answer=cleaned["Ideal Answer"],
                generated_by_ai=False,
            )
            result.questions_created += 1

    return result
