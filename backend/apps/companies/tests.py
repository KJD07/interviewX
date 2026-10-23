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

    def setUp(self):
        Company.objects.all().delete()  # start from an empty catalog, not the seeded skill bank

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


class SkillBankTests(TestCase):
    """The curated skill bank is loaded by migration 0010 and by seed_skills."""

    def sync(self):
        from .skill_bank import sync_skill_bank

        return sync_skill_bank(Company, Role, Round, InterviewQuestion)

    def test_bank_entries_are_well_formed(self):
        from .skill_bank import SKILLS

        names = [s["name"] for s in SKILLS]
        self.assertEqual(len(names), len(set(names)))
        valid_types = {t for t, _ in InterviewQuestion.QUESTION_TYPES}
        valid_rounds = set(Round.RoundType.values)
        for skill in SKILLS:
            self.assertIn(skill["tone_style"], {"formal_strict", "casual_friendly", "aggressive"})
            self.assertTrue(skill["category"])
            for title, round_type, questions in skill["rounds"]:
                self.assertIn(round_type, valid_rounds, title)
                self.assertGreaterEqual(len(questions), 3, f"{skill['name']} / {title}")
                for q in questions:
                    self.assertIn(q["question_type"], valid_types)
                    self.assertGreater(len(q["ideal_answer"]), 40, q["question_text"])

    def test_migration_seeded_the_bank_and_sync_is_idempotent(self):
        self.assertGreaterEqual(Company.objects.filter(kind="skill").count(), 20)
        self.assertEqual(self.sync(), {"skills": 0, "rounds": 0, "questions": 0})

    def test_fills_existing_rounds_without_touching_admin_edits(self):
        Company.objects.all().delete()
        react = Company.objects.create(name="React", kind="skill", tone_style="aggressive", description="mine")
        role = Role.objects.create(company=react, title="Intermediate")
        rnd = Round.objects.create(role=role, title="Core Concepts")
        InterviewQuestion.objects.create(round=rnd, question_text="Admin question", question_type="other")
        self.sync()
        react.refresh_from_db()
        self.assertEqual((react.tone_style, react.description), ("aggressive", "mine"))
        self.assertEqual(Round.objects.filter(role__company=react, title="Core Concepts").count(), 1)
        self.assertEqual(rnd.questions.count(), 4)  # admin's question kept + 3 curated ones

    def test_skills_endpoint_lists_the_bank(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient

        user = get_user_model().objects.create_user(username="s", email="s@ex.com", password="pw12345!")
        client = APIClient()
        client.force_authenticate(user)
        data = client.get("/api/companies/?kind=skill").data
        by_name = {c["name"]: c for c in data}
        self.assertIn("Data Structures & Algorithms", by_name)
        self.assertGreaterEqual(by_name["React"]["question_count"], 9)
