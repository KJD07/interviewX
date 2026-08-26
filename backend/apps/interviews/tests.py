from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.companies.models import Company, Role, Round
from core.openrouter_client import build_interview_system_prompt

from .models import InterviewSession
from .views import _format_workspace_submission

User = get_user_model()


class WorkspaceSubmissionFormatTests(TestCase):
    """A mid-attempt draft snapshot and a real submission must not look the
    same to the interviewer model — the AI was moving on from (and grading)
    half-finished work the candidate hadn't handed in yet."""

    def test_submitted_design_is_labelled_as_submitted(self):
        text = _format_workspace_submission(
            "", {"type": "system_design", "content": "LB -> API -> DB"}
        )
        self.assertIn("Candidate submitted a system design write-up", text)
        self.assertNotIn("not submitted yet", text)

    def test_draft_design_is_labelled_as_in_progress(self):
        text = _format_workspace_submission(
            "", {"type": "system_design", "content": "LB -> ...", "draft": True}
        )
        self.assertIn("not submitted yet", text)
        self.assertNotIn("Candidate submitted a system design write-up", text)

    def test_draft_code_is_labelled_as_in_progress(self):
        text = _format_workspace_submission(
            "", {"type": "coding", "content": "def f():", "language": "python", "draft": True}
        )
        self.assertIn("not submitted yet", text)
        self.assertIn("python", text)


class ClarifyingQuestionPromptTests(TestCase):
    """Asking clarifying questions IS the system-design exercise, so the
    interviewer prompt has to tell the model to answer them instead of
    treating one as the candidate's attempt."""

    def test_prompt_tells_the_ai_to_answer_clarifying_questions(self):
        prompt = build_interview_system_prompt(
            company_name="Acme",
            company_tone="formal_strict",
            role_title="SDE-2",
            round_title="System Design",
            questions=[{"question_type": "system_design", "question_text": "Design a URL shortener."}],
        )
        self.assertIn("Clarifying questions are expected", prompt)
        self.assertIn("ANSWER IT", prompt)
        self.assertIn("do not grade it", prompt)
        self.assertIn(
            "Only move past a coding/design question once the candidate has actually submitted",
            prompt,
        )


class ChatWorkspaceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="cand", email="cand@example.com", password="pw12345!"
        )
        company = Company.objects.create(name="Acme", tone_style="formal_strict")
        role = Role.objects.create(company=company, title="SDE-2")
        self.round = Round.objects.create(
            role=role, title="System Design", round_type=Round.RoundType.SYSTEM_DESIGN
        )
        self.session = InterviewSession.objects.create(
            user=self.user,
            round=self.round,
            transcript=[{"role": "ai", "text": "Design a URL shortener.", "ts": "x",
                         "workspace": {"type": "system_design"}}],
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _chat(self, body):
        with patch(
            "apps.interviews.views.chat_completion",
            return_value="Assume 10M daily active users, read-heavy.",
        ):
            return self.client.post(
                f"/api/interviews/{self.session.pk}/chat/", body, format="json"
            )

    def test_clarifying_question_does_not_open_or_close_a_workspace(self):
        res = self._chat({"message": "What scale should I design for?"})
        self.assertEqual(res.status_code, 200)
        # No marker in the reply -> no workspace instruction, which is what
        # keeps the panel the candidate is working in on screen.
        self.assertIsNone(res.json()["open_workspace"])
        self.session.refresh_from_db()
        question_turn = self.session.transcript[1]
        self.assertEqual(question_turn["role"], "user")
        self.assertNotIn("workspace", question_turn)

    def test_draft_check_in_is_stored_as_a_draft(self):
        res = self._chat(
            {
                "message": "",
                "workspace": {"type": "system_design", "content": "LB -> API", "draft": True},
            }
        )
        self.assertEqual(res.status_code, 200)
        self.session.refresh_from_db()
        self.assertTrue(self.session.transcript[1]["workspace"]["draft"])
        self.assertIn("not submitted yet", self.session.transcript[1]["text"])

    def test_real_submission_is_not_marked_draft(self):
        self._chat({"message": "", "workspace": {"type": "system_design", "content": "LB -> API"}})
        self.session.refresh_from_db()
        self.assertFalse(self.session.transcript[1]["workspace"]["draft"])

    def test_unknown_workspace_keys_are_not_persisted(self):
        self._chat(
            {
                "message": "",
                "workspace": {"type": "system_design", "content": "LB", "evil": "x"},
            }
        )
        self.session.refresh_from_db()
        self.assertNotIn("evil", self.session.transcript[1]["workspace"])
