from rest_framework import status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.question_sourcing import QuestionSourcingError, source_questions_for_round

from .models import Company, InterviewQuestion, Role, Round
from .serializers import (
    CompanyListSerializer,
    CompanySerializer,
    RoleSerializer,
    RoundSerializer,
)


def _access_denied_detail(company) -> str:
    if company.kind == Company.Kind.SKILL:
        return "Skill-based interviews are available on Premium and Max plans."
    return "This company is only available on a paid plan."


class CompanyListView(APIView):
    """
    GET /api/companies/ — list all companies (flat, no nested roles).
    GET /api/companies/?kind=skill — list skill-based practice entries instead.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        kind = request.query_params.get("kind", Company.Kind.COMPANY)
        companies = Company.objects.filter(kind=kind)
        plan = request.user.subscription_plan
        if kind == Company.Kind.SKILL:
            # Skills are all-or-nothing: not entitled -> nothing shown.
            if not Company(kind=Company.Kind.SKILL).is_accessible_by(plan):
                companies = Company.objects.none()
        elif plan == "free":
            companies = companies.filter(is_free=True)
        serializer = CompanyListSerializer(companies, many=True)
        return Response(serializer.data)


class CompanyDetailView(APIView):
    """GET /api/companies/<company_id>/ — full company with nested roles→rounds→questions."""

    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        try:
            company = Company.objects.prefetch_related(
                "roles__rounds__questions"
            ).get(pk=company_id)
        except Company.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not company.is_accessible_by(request.user.subscription_plan):
            return Response(
                {"detail": _access_denied_detail(company)},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CompanySerializer(company)
        return Response(serializer.data)


class RoleListView(APIView):
    """GET /api/companies/<company_id>/roles/ — roles for a company, each with rounds."""

    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        try:
            company = Company.objects.get(pk=company_id)
        except Company.DoesNotExist:
            return Response({"detail": "Company not found."}, status=status.HTTP_404_NOT_FOUND)
        if not company.is_accessible_by(request.user.subscription_plan):
            return Response(
                {"detail": _access_denied_detail(company)},
                status=status.HTTP_403_FORBIDDEN,
            )
        roles = Role.objects.filter(company_id=company_id).prefetch_related(
            "rounds__questions"
        )
        serializer = RoleSerializer(roles, many=True)
        return Response(serializer.data)


class RoundListView(APIView):
    """GET /api/companies/<company_id>/roles/<role_id>/rounds/ — rounds with questions."""

    permission_classes = [IsAuthenticated]

    def get(self, request, company_id, role_id):
        try:
            role = Role.objects.select_related("company").get(pk=role_id, company_id=company_id)
        except Role.DoesNotExist:
            return Response({"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND)
        if not role.company.is_accessible_by(request.user.subscription_plan):
            return Response(
                {"detail": _access_denied_detail(role.company)},
                status=status.HTTP_403_FORBIDDEN,
            )
        rounds = Round.objects.filter(role=role).prefetch_related("questions")
        serializer = RoundSerializer(rounds, many=True)
        return Response(serializer.data)


class RoundDetailView(APIView):
    """GET /api/companies/<company_id>/roles/<role_id>/rounds/<round_id>/ — single round with questions."""

    permission_classes = [IsAuthenticated]

    def get(self, request, company_id, role_id, round_id):
        try:
            round_ = Round.objects.prefetch_related("questions").get(
                pk=round_id,
                role_id=role_id,
                role__company_id=company_id,
            )
        except Round.DoesNotExist:
            return Response({"detail": "Round not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = RoundSerializer(round_)
        return Response(serializer.data)


class GenerateRoundQuestionsView(APIView):
    """
    POST /api/companies/<company_id>/roles/<role_id>/rounds/<round_id>/generate-questions/

    Uses the AI question-sourcing pipeline to find real, candidate-reported
    interview questions instead of requiring an admin to type them by hand.
    Replaces any previously AI-sourced questions for this round;
    manually-entered questions (generated_by_ai=False) are left untouched.
    """

    permission_classes = [IsAdminUser]

    def post(self, request, company_id, role_id, round_id):
        try:
            round_obj = Round.objects.select_related("role__company").get(
                pk=round_id, role_id=role_id, role__company_id=company_id
            )
        except Round.DoesNotExist:
            return Response({"detail": "Round not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            sourced = source_questions_for_round(
                company_name=round_obj.role.company.name,
                role_title=round_obj.role.title,
                round_title=round_obj.title,
            )
        except QuestionSourcingError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        # Replace prior AI-sourced questions; keep manually-entered ones.
        round_obj.questions.filter(generated_by_ai=True).delete()
        InterviewQuestion.objects.bulk_create(
            [
                InterviewQuestion(
                    round=round_obj,
                    question_text=q.question_text,
                    question_type=q.question_type,
                    ideal_answer=q.ideal_answer,
                    source_url=q.source_url,
                    generated_by_ai=True,
                )
                for q in sourced
            ]
        )

        serializer = RoundSerializer(round_obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED)