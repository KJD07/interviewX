from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient


class SupportChatTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_rejects_empty_messages(self):
        res = self.client.post("/api/support/chat/", {"messages": []}, format="json")
        self.assertEqual(res.status_code, 400)

    @patch("apps.support.views.chat_completion", return_value="Visit /pricing for plans.")
    def test_returns_assistant_reply(self, _mock_llm):
        res = self.client.post(
            "/api/support/chat/",
            {"messages": [{"role": "user", "content": "How much is Pro?"}]},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["reply"], "Visit /pricing for plans.")

    @patch("apps.support.views.chat_completion")
    def test_includes_system_prompt(self, mock_llm):
        mock_llm.return_value = "ok"
        self.client.post(
            "/api/support/chat/",
            {"messages": [{"role": "user", "content": "What is EvaluLabs?"}]},
            format="json",
        )
        sent = mock_llm.call_args[0][0]
        self.assertEqual(sent[0]["role"], "system")
        self.assertIn("EvaluLabs Help", sent[0]["content"])
        self.assertIn("user", [m["role"] for m in sent[1:]])

    def test_rejects_non_user_last_message(self):
        res = self.client.post(
            "/api/support/chat/",
            {
                "messages": [
                    {"role": "user", "content": "Hi"},
                    {"role": "assistant", "content": "Hello"},
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
