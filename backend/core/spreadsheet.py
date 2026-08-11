"""
Shared .xlsx/.csv reading for the admin bulk-upload pages.

Both apps.companies.imports (companies/roles/rounds/questions) and
apps.subscriptions.imports (sponsorship member emails) parse an
admin-uploaded spreadsheet into a list of header-keyed dicts before doing
their own row handling — that parsing lives here so the two importers
can't drift apart.

File-level problems (unreadable file, unsupported extension, no rows) raise
SpreadsheetError and abort the whole import; per-row problems are the
caller's business and are counted rather than raised.
"""

from __future__ import annotations

import csv
import io


class SpreadsheetError(Exception):
    """File-level problem that aborts the whole import."""


def _read_xlsx(uploaded_file) -> list[dict[str, object]]:
    import openpyxl

    wb = openpyxl.load_workbook(uploaded_file, read_only=True, data_only=True)
    sheet = wb.active
    rows_iter = sheet.iter_rows(values_only=True)
    try:
        header = [str(c).strip() if c is not None else "" for c in next(rows_iter)]
    except StopIteration:
        raise SpreadsheetError("The uploaded file has no rows.")

    rows = []
    for raw_row in rows_iter:
        if raw_row is None or all(v is None for v in raw_row):
            continue
        rows.append({header[i]: raw_row[i] for i in range(len(header)) if i < len(raw_row)})
    return rows


def _read_csv(uploaded_file) -> list[dict[str, object]]:
    raw = uploaded_file.read()
    text = raw.decode("utf-8-sig") if isinstance(raw, bytes) else raw
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def read_rows(uploaded_file) -> list[dict[str, object]]:
    name = (uploaded_file.name or "").lower()
    if name.endswith(".xlsx"):
        return _read_xlsx(uploaded_file)
    if name.endswith(".csv"):
        return _read_csv(uploaded_file)
    raise SpreadsheetError(
        f"Unsupported file type: {uploaded_file.name!r}. Upload a .xlsx or .csv file."
    )


def clean(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def require_columns(rows: list[dict[str, object]], required: list[str]) -> None:
    """Raise if the header is missing any required column. A file with no data
    rows has no header to check and is left to the caller to report as an
    empty import."""
    if not rows:
        return
    missing = [c for c in required if c not in rows[0]]
    if missing:
        raise SpreadsheetError(
            f"Missing required column(s): {', '.join(missing)}. "
            f"Expected header: {', '.join(required)}"
        )
