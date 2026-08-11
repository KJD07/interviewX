from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from .imports import SpreadsheetImportError, import_spreadsheet
from .models import Company, InterviewQuestion, Role, Round
from .serializers import RoundSerializer


class RoundTypeTests(TestCase):
    """Covers the bug where the frontend read round.round_type but the
    field didn't exist on the model at all."""

    def setUp(self):
        self.company = Company.objects.create(name="Acme", tone_style="formal_strict")
        self.role = Role.objects.create(company=self.company, title="SDE-2")

    def test_round_type_defaults_to_technical(self):
        round_obj = Round.objects.create(role=self.role, title="Technical Round 1")
        self.assertEqual(round_obj.round_type, Round.RoundType.TECHNICAL)

    def test_round_type_is_serialized(self):
        round_obj = Round.objects.create(
            role=self.role, title="HR Round", round_type=Round.RoundType.HR
        )
        data = RoundSerializer(round_obj).data
        self.assertEqual(data["round_type"], "hr")

    def test_infer_round_type_hr(self):
        self.assertEqual(Round.infer_round_type("Googleyness & Leadership"), "hr")
        self.assertEqual(Round.infer_round_type("HR Interview"), "hr")

    def test_infer_round_type_system_design(self):
        self.assertEqual(
            Round.infer_round_type("Technical Round 2 (System Design)"), "system_design"
        )

    def test_infer_round_type_behavioral(self):
        self.assertEqual(Round.infer_round_type("Behavioral Round"), "behavioral")

    def test_infer_round_type_defaults_technical(self):
        self.assertEqual(Round.infer_round_type("Aptitude & Coding Test"), "technical")


HEADER = "Company,Role,Round,Question Title,Difficulty,Category,Date,URL\n"
ROW = "Acme,SDE-2,Technical,Reverse a linked list,Medium,Coding,2025-01-01,http://x.test\n"


def _csv(body: str, name: str = "questions.csv") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, body.encode("utf-8"), content_type="text/csv")


class SpreadsheetImportTests(TestCase):
    """Regression cover for the questions importer — it had none before the
    .xlsx/.csv reading was factored out into core.spreadsheet and shared with
    the sponsorship email importer."""

    def test_imports_a_csv_row_creating_the_full_chain(self):
        result = import_spreadsheet(_csv(HEADER + ROW))

        self.assertEqual(result.questions_created, 1)
        self.assertEqual(result.companies_created, 1)
        self.assertEqual(result.roles_created, 1)
        self.assertEqual(result.rounds_created, 1)

        question = InterviewQuestion.objects.get()
        self.assertEqual(question.question_text, "Reverse a linked list")
        self.assertEqual(question.question_type, "coding")
        self.assertEqual(question.round.role.company.name, "Acme")
        self.assertFalse(question.generated_by_ai)

    def test_skips_rows_missing_a_required_field(self):
        incomplete = ",SDE-2,Technical,Some question,Medium,Coding,2025-01-01,http://x.test\n"
        result = import_spreadsheet(_csv(HEADER + ROW + incomplete))

        self.assertEqual(result.rows_seen, 2)
        self.assertEqual(result.questions_created, 1)
        self.assertEqual(result.rows_skipped, 1)
        self.assertTrue(result.skipped_examples)

    def test_reimporting_skips_already_imported_questions(self):
        import_spreadsheet(_csv(HEADER + ROW))
        result = import_spreadsheet(_csv(HEADER + ROW))

        self.assertEqual(result.questions_created, 0)
        self.assertEqual(result.questions_skipped_duplicate, 1)
        self.assertEqual(InterviewQuestion.objects.count(), 1)

    def test_missing_column_aborts_the_import(self):
        with self.assertRaises(SpreadsheetImportError):
            import_spreadsheet(_csv("Company,Role\nAcme,SDE-2\n"))

        self.assertEqual(Company.objects.count(), 0)

    def test_unsupported_file_type_is_rejected(self):
        with self.assertRaises(SpreadsheetImportError):
            import_spreadsheet(SimpleUploadedFile("questions.txt", (HEADER + ROW).encode()))

    def test_imports_an_xlsx_row(self):
        import openpyxl

        wb = openpyxl.Workbook()
        sheet = wb.active
        sheet.append(HEADER.strip().split(","))
        sheet.append(ROW.strip().split(","))
        buf = BytesIO()
        wb.save(buf)

        result = import_spreadsheet(
            SimpleUploadedFile("questions.xlsx", buf.getvalue())
        )

        self.assertEqual(result.questions_created, 1)
