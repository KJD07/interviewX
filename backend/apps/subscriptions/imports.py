"""
Bulk-import SponsorshipMember rows (individual covered emails) for one
campaign from an uploaded .xlsx or .csv spreadsheet — see the "Upload
emails" admin page wired up on SponsorshipCampaignAdmin.

Expected header row (exact match, case-sensitive):
    Email

Only the email list comes from the file; how many interviews these people
get, over what cycle, and until when all live on the campaign itself and
are set in the admin form. Rows with a blank or malformed email are skipped
and counted rather than erroring the whole import, matching the
companies importer's behaviour on raw exports.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction

from core.spreadsheet import clean, read_rows, require_columns

from .models import SponsorshipMember

REQUIRED_COLUMNS = ["Email"]

# Cap on how many bad rows we quote back in the admin message — the same
# ceiling the companies importer uses, so a 10k-row export can't produce a
# page-long banner.
MAX_SKIPPED_EXAMPLES = 20


@dataclass
class MemberImportResult:
    rows_seen: int = 0
    rows_skipped: int = 0
    skipped_examples: list[str] = field(default_factory=list)
    members_created: int = 0
    members_skipped_duplicate: int = 0


def _record_skip(result: MemberImportResult, reason: str) -> None:
    result.rows_skipped += 1
    if len(result.skipped_examples) < MAX_SKIPPED_EXAMPLES:
        result.skipped_examples.append(f"row {result.rows_seen}: {reason}")


def import_sponsorship_emails(campaign, uploaded_file) -> MemberImportResult:
    """Entry point: parse the uploaded file and attach every valid email to
    `campaign` as a SponsorshipMember. Re-uploading the same file is safe —
    emails already on the campaign are counted as duplicates, not errors."""
    rows = read_rows(uploaded_file)
    require_columns(rows, REQUIRED_COLUMNS)

    result = MemberImportResult()

    with transaction.atomic():
        # One query for the campaign's existing emails instead of one
        # exists() per row, then kept up to date in-memory so duplicates
        # *within* the uploaded file are caught too.
        existing = set(
            SponsorshipMember.objects.filter(campaign=campaign).values_list("email", flat=True)
        )

        to_create = []
        for raw_row in rows:
            result.rows_seen += 1
            email = clean(raw_row.get("Email")).lower()

            if not email:
                _record_skip(result, "blank email")
                continue

            try:
                validate_email(email)
            except ValidationError:
                _record_skip(result, f"not a valid email ({email!r})")
                continue

            if email in existing:
                result.members_skipped_duplicate += 1
                continue

            existing.add(email)
            to_create.append(SponsorshipMember(campaign=campaign, email=email))

        SponsorshipMember.objects.bulk_create(to_create)
        result.members_created = len(to_create)

    return result
