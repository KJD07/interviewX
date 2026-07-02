import json
import random
from datetime import datetime, timedelta, timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.models import Round
from core.openrouter_client import (
    build_feedback_prompt,
    build_interview_system_prompt,
    chat_completion,
)

from .models import InterviewSession
from .serializers import InterviewSessionListSerializer, InterviewSessionSerializer

FREE_PLAN_MONTHLY_LIMIT = 2

# Every interview session gets a randomized time limit in this range.
MIN_INTERVIEW_MINUTES = 45
MAX_INTERVIEW_MINUTES = 60


def _seconds_remaining(session: InterviewSession) -> float:
    """How many seconds are left before this session's time limit is hit."""
    deadline = session.started_at + timedelta(minutes=session.duration_minutes)
    return (deadline - datetime.now(timezone.utc)).total_seconds()


# ── existing CRUD views (unchanged) ──────────────────────────────────────────

class InterviewSessionListCreateView(APIView):
    """
    GET  /api/interviews/  — list the authenticated user's sessions (flat).
    POST /api/interviews/  — create a new session for the authenticated user.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = InterviewSession.objects.filter(user=request.user).order_by(
            "-started_at"
        )
        serializer = InterviewSessionListSerializer(sessions, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = InterviewSessionSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InterviewSessionDetailView(APIView):
    """
    GET    /api/interviews/<session_id>/
    PATCH  /api/interviews/<session_id>/
    """

    permission_classes = [IsAuthenticated]

    def _get_session(self, session_id, user):
        try:
            return InterviewSession.objects.get(pk=session_id, user=user)
        except InterviewSession.DoesNotExist:
            return None

    def get(self, request, session_id):
        session = self._get_session(session_id, request.user)
        if session is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = InterviewSessionSerializer(session)
        return Response(serializer.data)

    def patch(self, request, session_id):
        session = self._get_session(session_id, request.user)
        if session is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = InterviewSessionSerializer(
            session,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Phase 5: AI interview engine ──────────────────────────────────────────────

def _get_round_with_context(round_id: int):
    """Return (round, questions_list) or raise Round.DoesNotExist."""
    round_obj = (
        Round.objects.select_related("role__company")
        .prefetch_related("questions")
        .get(pk=round_id)
    )
    questions = list(
        round_obj.questions.values("question_text", "question_type", "ideal_answer")
    )
    return round_obj, questions


def _build_openrouter_messages(session: InterviewSession, system_prompt: str) -> list:
    """Convert stored transcript to OpenRouter messages format."""
    messages = [{"role": "system", "content": system_prompt}]
    for turn in session.transcript:
        role = "user" if turn["role"] == "user" else "assistant"
        messages.append({"role": role, "content": turn["text"]})
    return messages


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class StartInterviewView(APIView):
    """
    POST /api/interviews/start/
    Body: {"round_id": <int>}

    Checks free plan limit, creates session, gets opening message from AI.
    Returns: session data + first AI message.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        round_id = request.data.get("round_id")
        if not round_id:
            return Response(
                {"detail": "round_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Plan limit check (Phase 7 will move this to subscriptions app)
        user = request.user
        if (
            user.subscription_plan == "free"
            and user.interviews_this_month >= FREE_PLAN_MONTHLY_LIMIT
        ):
            return Response(
                {
                    "detail": "Free plan limit reached (2 interviews/month). Upgrade to continue.",
                    "code": "plan_limit_reached",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            round_obj, questions = _get_round_with_context(round_id)
        except Round.DoesNotExist:
            return Response(
                {"detail": "Round not found."}, status=status.HTTP_404_NOT_FOUND
            )

        # Build system prompt
        system_prompt = build_interview_system_prompt(
            company_name=round_obj.role.company.name,
            company_tone=round_obj.role.company.tone_style,
            role_title=round_obj.role.title,
            round_title=round_obj.title,
            questions=questions,
        )

        # Get opening message from AI (no user turn yet)
        try:
            opening = chat_completion(
                [{"role": "system", "content": system_prompt}]
            )
        except RuntimeError as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY
            )

        # Create session with AI opening turn already in transcript
        session = InterviewSession.objects.create(
            user=user,
            round=round_obj,
            status=InterviewSession.Status.IN_PROGRESS,
            transcript=[{"role": "ai", "text": opening, "ts": _now_iso()}],
            duration_minutes=random.randint(
                MIN_INTERVIEW_MINUTES, MAX_INTERVIEW_MINUTES
            ),
        )

        # Increment usage counter
        user.interviews_this_month += 1
        user.save(update_fields=["interviews_this_month"])

        return Response(
            {
                "session_id": session.pk,
                "ai_message": opening,
                "session": InterviewSessionSerializer(session).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ChatView(APIView):
    """
    POST /api/interviews/<session_id>/chat/
    Body: {"message": "<user's answer>"}

    Appends user turn, calls OpenRouter, appends AI reply, returns AI reply.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = InterviewSession.objects.get(
                pk=session_id, user=request.user
            )
        except InterviewSession.DoesNotExist:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if session.status != InterviewSession.Status.IN_PROGRESS:
            return Response(
                {"detail": "Session is not in progress."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Time's up — auto-score and complete the session instead of
        # accepting another answer.
        if _seconds_remaining(session) <= 0:
            result = _score_and_complete_session(session, time_expired=True)
            if isinstance(result, Response):
                return result
            serializer = InterviewSessionSerializer(result)
            return Response(
                {
                    "detail": "Time limit reached. Interview has ended.",
                    "code": "time_expired",
                    "session": serializer.data,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_message = request.data.get("message", "").strip()
        if not user_message:
            return Response(
                {"detail": "message is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Rebuild context
        try:
            round_obj, questions = _get_round_with_context(session.round_id)
        except Round.DoesNotExist:
            return Response(
                {"detail": "Round not found."}, status=status.HTTP_404_NOT_FOUND
            )

        system_prompt = build_interview_system_prompt(
            company_name=round_obj.role.company.name,
            company_tone=round_obj.role.company.tone_style,
            role_title=round_obj.role.title,
            round_title=round_obj.title,
            questions=questions,
        )

        # Append user turn to transcript
        transcript = list(session.transcript)
        transcript.append({"role": "user", "text": user_message, "ts": _now_iso()})

        # Build full message history and call AI
        messages = _build_openrouter_messages(
            session, system_prompt
        )
        # _build_openrouter_messages reads from session.transcript (pre-append),
        # so manually add the new user turn
        messages.append({"role": "user", "content": user_message})

        try:
            ai_reply = chat_completion(messages)
        except RuntimeError as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY
            )

        # Append AI turn
        transcript.append({"role": "ai", "text": ai_reply, "ts": _now_iso()})

        session.transcript = transcript
        session.save(update_fields=["transcript"])

        return Response({"ai_message": ai_reply})


def _score_and_complete_session(session: InterviewSession, *, time_expired: bool = False):
    """
    Shared scoring/completion logic used by both the manual "End interview"
    action and the automatic cutoff when a session's time limit is reached.

    Returns either a Response (on error) or the completed InterviewSession.
    """
    try:
        round_obj, questions = _get_round_with_context(session.round_id)
    except Round.DoesNotExist:
        return Response(
            {"detail": "Round not found."}, status=status.HTTP_404_NOT_FOUND
        )

    feedback_messages = build_feedback_prompt(
        transcript=session.transcript,
        company_name=round_obj.role.company.name,
        role_title=round_obj.role.title,
        round_title=round_obj.title,
        questions=questions,
    )

    try:
        raw = chat_completion(feedback_messages)
        # Strip markdown fences if model wraps JSON in ```json ... ```
        clean = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        result = json.loads(clean)
    except RuntimeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
    except json.JSONDecodeError:
        return Response(
            {"detail": f"AI returned non-JSON feedback: {raw[:200]}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    scores = {
        "communication": result.get("communication", 0),
        "technical": result.get("technical", 0),
        "problem_solving": result.get("problem_solving", 0),
        "overall": result.get("overall", 0),
    }
    feedback_text = result.get("feedback", "")

    session.scores = scores
    session.feedback = feedback_text
    session.status = InterviewSession.Status.COMPLETED
    session.ended_at = datetime.now(timezone.utc)
    session.time_expired = time_expired
    session.save(
        update_fields=["scores", "feedback", "status", "ended_at", "time_expired"]
    )
    return session


class EndInterviewView(APIView):
    """
    POST /api/interviews/<session_id>/end/

    Calls OpenRouter for scoring/feedback, saves results, marks session completed.
    Returns full session with scores and feedback.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = InterviewSession.objects.get(
                pk=session_id, user=request.user
            )
        except InterviewSession.DoesNotExist:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if session.status == InterviewSession.Status.COMPLETED:
            return Response(
                {"detail": "Session already completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = _score_and_complete_session(session)
        if isinstance(result, Response):
            return result

        serializer = InterviewSessionSerializer(result)
        return Response(serializer.data)