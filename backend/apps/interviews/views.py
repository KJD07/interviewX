import json
import random
from datetime import datetime, timedelta, timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.models import Round
from apps.subscriptions.plans import has_insights, monthly_limit_for
from core.openrouter_client import (
    build_feedback_prompt,
    build_interview_system_prompt,
    chat_completion,
)

from .models import InterviewSession
from .serializers import InterviewSessionListSerializer, InterviewSessionSerializer

# Kept for backward-compat imports elsewhere (e.g. frontend limit displays via API).
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

        # Plan limit check — None means unlimited (Max plan).
        user = request.user
        limit = monthly_limit_for(user.subscription_plan)
        if limit is not None and user.interviews_this_month >= limit:
            return Response(
                {
                    "detail": (
                        f"You've reached your {user.subscription_plan} plan limit "
                        f"({limit} interviews/month). Upgrade to continue."
                    ),
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


# Non-attempts that should never earn meaningful credit, regardless of what
# the LLM grader decides. Matched case-insensitively against the full text
# of a candidate turn (after stripping punctuation/whitespace).
_NON_ANSWER_PHRASES = {
    "", "i don't know", "i dont know", "idk", "no idea", "not sure",
    "skip", "pass", "next", "i have no idea", "dont know", "don't know",
    "no clue", "no comment", "n/a", "na",
}


def _normalize_for_check(text: str) -> str:
    return "".join(ch for ch in text.strip().lower() if ch.isalnum() or ch.isspace()).strip()


def _analyze_candidate_engagement(transcript: list[dict]) -> dict:
    """
    Deterministically measure how much the candidate actually engaged with
    the interview, independent of the LLM grader. Used to (a) give the LLM
    hard numbers to anchor its scoring against, and (b) clamp the final
    scores as a hard guardrail so a blank/non-attempt interview can never
    surface a misleadingly generous mid-range score.
    """
    candidate_turns = [t for t in transcript if t.get("role") == "user"]
    total_turns = len(candidate_turns)

    word_counts = [len(t.get("text", "").split()) for t in candidate_turns]
    total_words = sum(word_counts)

    non_answer_count = sum(
        1 for t in candidate_turns
        if _normalize_for_check(t.get("text", "")) in _NON_ANSWER_PHRASES
    )
    # Also count answers that are just a couple of throwaway words (e.g. "idk lol")
    trivial_count = sum(1 for wc in word_counts if wc <= 2)

    substantive_turns = max(total_turns - max(non_answer_count, trivial_count), 0)
    substantive_ratio = (substantive_turns / total_turns) if total_turns else 0.0

    summary_lines = [
        f"- Candidate turns: {total_turns}",
        f"- Total words typed/spoken by candidate across all answers: {total_words}",
        f"- Non-answers (blank, 'I don't know', 'skip', etc.): {non_answer_count}/{total_turns}",
        f"- Turns with 2 words or fewer: {trivial_count}/{total_turns}",
        f"- Estimated substantive answers: {substantive_turns}/{total_turns}",
    ]

    return {
        "total_turns": total_turns,
        "total_words": total_words,
        "non_answer_count": non_answer_count,
        "trivial_count": trivial_count,
        "substantive_ratio": substantive_ratio,
        "summary_text": "\n".join(summary_lines),
    }


def _clamp_scores_to_engagement(scores: dict, engagement: dict) -> dict:
    """
    Hard guardrail: if the candidate barely engaged at all, cap every score
    low regardless of what the LLM returned. This protects against LLM
    leniency (e.g. defaulting to a "neutral" 5-6 out of politeness) when
    there is nothing to actually evaluate.
    """
    total_turns = engagement["total_turns"]
    if total_turns == 0:
        return {k: 0 for k in scores}

    # No real engagement at all -> hard clamp near zero.
    if engagement["total_words"] == 0 or engagement["non_answer_count"] == total_turns:
        cap = 1
    # Almost everything was a non-answer or trivial throwaway -> very low cap.
    elif engagement["substantive_ratio"] <= 0.2:
        cap = 2
    elif engagement["substantive_ratio"] <= 0.4:
        cap = 4
    else:
        cap = 10  # no clamp needed

    if cap == 10:
        return scores
    return {k: min(v, cap) if isinstance(v, (int, float)) else v for k, v in scores.items()}


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

    detailed = has_insights(session.user.subscription_plan)

    engagement = _analyze_candidate_engagement(session.transcript)

    feedback_messages = build_feedback_prompt(
        transcript=session.transcript,
        company_name=round_obj.role.company.name,
        role_title=round_obj.role.title,
        round_title=round_obj.title,
        questions=questions,
        detailed=detailed,
        engagement_summary=engagement["summary_text"],
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
    scores_before_clamp = dict(scores)
    scores = _clamp_scores_to_engagement(scores, engagement)
    was_clamped = scores != scores_before_clamp

    feedback_text = result.get("feedback", "")
    if was_clamped and engagement["total_words"] == 0:
        feedback_text = (
            "No answers were provided during this interview, so no real assessment "
            "of your skills could be made. Try the interview again and answer each "
            "question — even a partial or uncertain attempt is scored far better "
            "than no answer at all."
        )
    elif was_clamped:
        feedback_text = (
            (feedback_text + " " if feedback_text else "")
            + "Note: most questions received little to no substantive answer, "
            "so scores reflect that limited engagement rather than technical ability alone."
        )

    insights = {}
    if detailed:
        topics = result.get("topics", [])
        improvement_areas = result.get("improvement_areas", [])
        if was_clamped:
            cap = max(scores.values()) if scores else 2
            topics = [
                {**t, "score": min(t.get("score", 0), cap)} if isinstance(t, dict) else t
                for t in topics
            ]
        insights = {
            "topics": topics,
            "improvement_areas": improvement_areas,
        }

    session.scores = scores
    session.feedback = feedback_text
    session.insights = insights
    session.status = InterviewSession.Status.COMPLETED
    session.ended_at = datetime.now(timezone.utc)
    session.time_expired = time_expired
    session.save(
        update_fields=["scores", "feedback", "insights", "status", "ended_at", "time_expired"]
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