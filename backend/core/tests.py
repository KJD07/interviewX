from django.test import SimpleTestCase

from .openrouter_client import build_interview_system_prompt


class TonePromptTests(SimpleTestCase):
    """Covers the bug where seed data used tone_style values like
    'formal_strict' / 'casual_friendly' but the prompt builder's dict only
    had keys 'formal' / 'casual' / 'aggressive', so every seeded company
    silently fell through to the generic fallback tone."""

    def _questions(self):
        return [{"question_type": "technical", "question_text": "Explain closures."}]

    def test_formal_strict_gets_specific_instructions(self):
        prompt = build_interview_system_prompt(
            company_name="Acme",
            company_tone="formal_strict",
            role_title="SDE-2",
            round_title="Technical Round 1",
            questions=self._questions(),
        )
        self.assertIn("professional, precise, and measured", prompt)
        self.assertNotIn("Your tone is formal_strict", prompt)

    def test_casual_friendly_gets_specific_instructions(self):
        prompt = build_interview_system_prompt(
            company_name="Acme",
            company_tone="casual_friendly",
            role_title="SDE-2",
            round_title="Technical Round 1",
            questions=self._questions(),
        )
        self.assertIn("relaxed and conversational", prompt)
        self.assertNotIn("Your tone is casual_friendly", prompt)

    def test_unknown_tone_falls_back_gracefully(self):
        prompt = build_interview_system_prompt(
            company_name="Acme",
            company_tone="quirky",
            role_title="SDE-2",
            round_title="Technical Round 1",
            questions=self._questions(),
        )
        self.assertIn("Your tone is quirky", prompt)
