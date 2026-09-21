from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.openrouter_client import chat_completion

from .prompts import build_support_system_prompt
from .throttles import SupportChatThrottle

MAX_MESSAGES = 20
MAX_CONTENT_LEN = 2000
ALLOWED_ROLES = frozenset({"user", "assistant"})


class SupportChatView(APIView):
    """POST /api/support/chat/ — public site help chatbot (EvaluLabs-only)."""

    permission_classes = [AllowAny]
    throttle_classes = [SupportChatThrottle]
    throttle_scope = "support_chat"

    def post(self, request):
        raw_messages = request.data.get("messages")
        if not isinstance(raw_messages, list) or not raw_messages:
            return Response(
                {"messages": "Provide a non-empty list of {role, content} messages."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(raw_messages) > MAX_MESSAGES:
            return Response(
                {"messages": f"At most {MAX_MESSAGES} messages per request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        llm_messages = [{"role": "system", "content": build_support_system_prompt()}]
        for item in raw_messages:
            if not isinstance(item, dict):
                return Response({"messages": "Each message must be an object."}, status=status.HTTP_400_BAD_REQUEST)
            role = item.get("role")
            content = item.get("content")
            if role not in ALLOWED_ROLES:
                return Response(
                    {"messages": "Each message role must be 'user' or 'assistant'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not isinstance(content, str) or not content.strip():
                return Response(
                    {"messages": "Each message needs non-empty string content."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(content) > MAX_CONTENT_LEN:
                return Response(
                    {"messages": f"Each message must be at most {MAX_CONTENT_LEN} characters."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            llm_messages.append({"role": role, "content": content.strip()})

        if llm_messages[-1]["role"] != "user":
            return Response(
                {"messages": "The last message must be from the user."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reply = chat_completion(llm_messages, max_tokens=600, temperature=0.35)
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"reply": reply})
