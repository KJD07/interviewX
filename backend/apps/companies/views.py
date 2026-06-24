from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Company, Role, Round
from .serializers import (
    CompanyListSerializer,
    CompanySerializer,
    RoleSerializer,
    RoundSerializer,
)


class CompanyListView(APIView):
    """GET /api/companies/ — list all companies (flat, no nested roles)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        companies = Company.objects.all()
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
        serializer = CompanySerializer(company)
        return Response(serializer.data)


class RoleListView(APIView):
    """GET /api/companies/<company_id>/roles/ — roles for a company, each with rounds."""

    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        if not Company.objects.filter(pk=company_id).exists():
            return Response({"detail": "Company not found."}, status=status.HTTP_404_NOT_FOUND)
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
            role = Role.objects.get(pk=role_id, company_id=company_id)
        except Role.DoesNotExist:
            return Response({"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND)
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
