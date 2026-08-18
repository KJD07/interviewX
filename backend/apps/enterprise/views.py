import random

from django import forms
from django.db import transaction
from django.db.models import Count, F
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.models import Role, Round
from apps.interviews.models import InterviewSession
from apps.interviews.serializers import InterviewSessionSerializer
from apps.interviews.views import (
    CHAT_REPLY_MAX_TOKENS,
    MAX_INTERVIEW_MINUTES,
    MIN_INTERVIEW_MINUTES,
    _fallback_opening_workspace,
    _get_round_with_context,
    _now_iso,
)
from core.openrouter_client import build_interview_system_prompt, chat_completion, extract_workspace_action

from .emails import send_candidate_invite_email
from .imports import OrgImportError, get_or_create_org_company, import_org_questions
from .models import Organization, OrgCandidateInvite, OrganizationMember, ProctoringEvent
from .serializers import (
    OrganizationSerializer,
    OrgCandidateInviteSerializer,
    OrgRoleSerializer,
    ProctoringEventSerializer,
)

# Clips are short, triggered captures (up to 15s from the flagged moment),
# not full-session recordings — this cap just guards against a
# runaway/misbehaving client.
MAX_PROCTORING_CLIP_BYTES = 15 * 1024 * 1024


class UploadQuestionsForm(forms.Form):
    file = forms.FileField()


def _get_membership(user):
    """A user's org membership, or None. v1 assumes one org per admin user —
    see OrganizationMember docstring for why this is a separate join model
    rather than a FK directly on User."""
    return (
        OrganizationMember.objects.select_related("organization")
        .filter(user=user)
        .first()
    )


class OrgDashboardView(APIView):
    """GET /api/enterprise/dashboard/ — the requesting user's org, quota
    usage, and question-bank summary. 404s (not 403) for non-members so an
    org's existence isn't leaked to accounts outside it."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_membership(request.user)
        if membership is None:
            return Response({"detail": "Not a member of any organization."}, status=status.HTTP_404_NOT_FOUND)

        organization = membership.organization
        company = get_or_create_org_company(organization)
        roles = Role.objects.filter(company=company).prefetch_related("rounds__questions")
        invite_counts = dict(
            OrgCandidateInvite.objects.filter(organization=organization)
            .values_list("status")
            .annotate(count=Count("id"))
        )

        return Response(
            {
                "organization": OrganizationSerializer(organization).data,
                "role": membership.role,
                "question_bank": OrgRoleSerializer(roles, many=True).data,
                "invite_counts": invite_counts,
            }
        )


class OrgQuestionUploadView(APIView):
    """POST /api/enterprise/question-bank/upload/ — self-serve CSV/XLSX/JSON
    upload of an org's own question bank (see apps.enterprise.imports).
    Admin-assisted upload of the same file shape is the launch-day fallback,
    done directly through Django admin rather than a separate endpoint."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        membership = _get_membership(request.user)
        if membership is None:
            return Response({"detail": "Not a member of any organization."}, status=status.HTTP_404_NOT_FOUND)

        form = UploadQuestionsForm(request.POST, request.FILES)
        if not form.is_valid() or not form.cleaned_data.get("file"):
            return Response({"detail": "A file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = import_org_questions(membership.organization, form.cleaned_data["file"])
        except OrgImportError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "rows_seen": result.rows_seen,
                "rows_skipped": result.rows_skipped,
                "skipped_examples": result.skipped_examples,
                "roles_created": result.roles_created,
                "rounds_created": result.rounds_created,
                "questions_created": result.questions_created,
                "questions_skipped_duplicate": result.questions_skipped_duplicate,
            },
            status=status.HTTP_201_CREATED,
        )


class OrgCandidateInviteListCreateView(APIView):
    """
    GET /api/enterprise/invites/ — list this org's candidate invites.
    POST /api/enterprise/invites/ — create one, body {round, candidate_email, expires_at}.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_membership(request.user)
        if membership is None:
            return Response({"detail": "Not a member of any organization."}, status=status.HTTP_404_NOT_FOUND)
        invites = OrgCandidateInvite.objects.filter(organization=membership.organization).select_related(
            "round__role"
        )
        return Response(OrgCandidateInviteSerializer(invites, many=True).data)

    def post(self, request):
        membership = _get_membership(request.user)
        if membership is None:
            return Response({"detail": "Not a member of any organization."}, status=status.HTTP_404_NOT_FOUND)

        # Only rounds under this org's own company are valid targets — a
        # PrimaryKeyRelatedField alone can't scope its queryset per-request,
        # so cross-org membership is rejected in the serializer's
        # validate_round instead (see OrgCandidateInviteSerializer).
        round_id = request.data.get("round")
        try:
            round_obj = Round.objects.select_related("role__company").get(pk=round_id)
        except (Round.DoesNotExist, ValueError, TypeError):
            return Response({"round": "Round not found."}, status=status.HTTP_400_BAD_REQUEST)
        if round_obj.role.company.organization_id != membership.organization_id:
            return Response(
                {"round": "This round doesn't belong to your organization."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = OrgCandidateInviteSerializer(
            data=request.data, context={"organization": membership.organization}
        )
        serializer.is_valid(raise_exception=True)
        invite = serializer.save(organization=membership.organization)
        send_candidate_invite_email(invite)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class OrgInviteStartView(APIView):
    """
    POST /api/enterprise/invites/<token>/start/ — candidate-facing. Starts
    the InterviewSession for an org invite.

    Reuses the exact same opening-message construction as the consumer
    StartInterviewView (apps.interviews.views): round/question fetch, system
    prompt, and the AI's opening call are identical — only the gating
    differs, since an invited candidate is checked against the org's
    candidate_quota rather than a personal subscription plan (they may have
    none). chat/ and end/ are untouched and apply to this session exactly as
    to any other.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        try:
            invite = OrgCandidateInvite.objects.select_related(
                "organization", "round__role__company"
            ).get(token=token)
        except OrgCandidateInvite.DoesNotExist:
            return Response({"detail": "Invite not found."}, status=status.HTTP_404_NOT_FOUND)

        if invite.candidate_email.strip().lower() != request.user.email.strip().lower():
            return Response(
                {"detail": "This invite was issued to a different email address."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if invite.status == OrgCandidateInvite.Status.PENDING and invite.is_expired:
            invite.status = OrgCandidateInvite.Status.EXPIRED
            invite.save(update_fields=["status"])
        if invite.status == OrgCandidateInvite.Status.EXPIRED:
            return Response({"detail": "This invite has expired."}, status=status.HTTP_410_GONE)
        if invite.status != OrgCandidateInvite.Status.PENDING:
            return Response(
                {"detail": f"This invite is already {invite.status}."},
                status=status.HTTP_409_CONFLICT,
            )

        organization = invite.organization
        if not organization.is_covered:
            return Response({"detail": "This organization's access has expired."}, status=status.HTTP_403_FORBIDDEN)
        if not organization.has_quota_remaining:
            return Response(
                {"detail": "This organization has used all of its interview quota."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            round_obj, questions = _get_round_with_context(invite.round_id)
        except Round.DoesNotExist:
            return Response({"detail": "Round not found."}, status=status.HTTP_404_NOT_FOUND)

        system_prompt = build_interview_system_prompt(
            company_name=round_obj.role.company.name,
            company_tone=round_obj.role.company.tone_style or "formal_strict",
            role_title=round_obj.role.title,
            round_title=round_obj.title,
            questions=questions,
            is_skill=False,
        )
        try:
            opening = chat_completion(
                [{"role": "system", "content": system_prompt}],
                max_tokens=CHAT_REPLY_MAX_TOKENS,
            )
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        opening, open_workspace = extract_workspace_action(opening)
        if not open_workspace:
            open_workspace = _fallback_opening_workspace(round_obj, questions)

        with transaction.atomic():
            organization = Organization.objects.select_for_update().get(pk=organization.pk)
            if not organization.has_quota_remaining:
                return Response(
                    {"detail": "This organization has used all of its interview quota."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            session = InterviewSession.objects.create(
                user=request.user,
                round=round_obj,
                transcript=[{"role": "ai", "text": opening, "ts": _now_iso()}],
                duration_minutes=random.randint(MIN_INTERVIEW_MINUTES, MAX_INTERVIEW_MINUTES),
            )
            organization.candidates_used = F("candidates_used") + 1
            organization.save(update_fields=["candidates_used"])
            invite.session = session
            invite.status = OrgCandidateInvite.Status.STARTED
            invite.save(update_fields=["session", "status"])

        serializer = InterviewSessionSerializer(session)
        return Response(
            {
                "session_id": session.id,
                "ai_message": opening,
                "open_workspace": open_workspace,
                "session": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class ProctoringEventCreateView(APIView):
    """
    POST /api/enterprise/sessions/<session_id>/proctoring-events/ —
    candidate-facing. Records one flagged moment (and optionally a short
    clip) for a proctored interview.

    404s for anything that isn't the requesting user's own in-progress,
    org-linked session — including a perfectly valid consumer session — so
    this endpoint can never be used to attach proctoring data to a non-
    enterprise interview, which is the actual enforcement point for
    "video capture is enterprise-only" (see ProctoringEvent docstring).
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, session_id):
        try:
            session = InterviewSession.objects.get(pk=session_id, user=request.user)
        except InterviewSession.DoesNotExist:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        if not session.org_invite.exists():
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        if session.status != InterviewSession.Status.IN_PROGRESS:
            return Response({"detail": "Session is not in progress."}, status=status.HTTP_409_CONFLICT)

        clip = request.FILES.get("clip")
        if clip is not None:
            if not (clip.content_type or "").startswith("video/"):
                return Response({"clip": "Must be a video file."}, status=status.HTTP_400_BAD_REQUEST)
            if clip.size > MAX_PROCTORING_CLIP_BYTES:
                return Response({"clip": "Clip is too large."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ProctoringEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(session=session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
