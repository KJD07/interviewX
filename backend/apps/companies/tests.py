from django.test import TestCase

from .models import Company, Role, Round
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
