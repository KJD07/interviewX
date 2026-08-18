from rest_framework import serializers

from apps.companies.models import InterviewQuestion, Role, Round

from .models import Organization, OrgCandidateInvite, ProctoringEvent


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "id", "name", "candidate_quota", "candidates_used",
            "contract_ends", "is_active",
        ]
        read_only_fields = fields


class OrgQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewQuestion
        fields = ["id", "question_text", "question_type", "ideal_answer", "starter_code", "language"]


class OrgRoundSerializer(serializers.ModelSerializer):
    questions = OrgQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Round
        fields = ["id", "title", "order", "round_type", "questions"]


class OrgRoleSerializer(serializers.ModelSerializer):
    rounds = OrgRoundSerializer(many=True, read_only=True)

    class Meta:
        model = Role
        fields = ["id", "title", "rounds"]


class OrgCandidateInviteSerializer(serializers.ModelSerializer):
    round_title = serializers.CharField(source="round.title", read_only=True)
    role_title = serializers.CharField(source="round.role.title", read_only=True)

    class Meta:
        model = OrgCandidateInvite
        fields = [
            "id", "candidate_email", "round", "round_title", "role_title",
            "token", "status", "session", "created_at", "expires_at",
        ]
        read_only_fields = ["id", "token", "status", "session", "created_at", "round_title", "role_title"]

    def validate_round(self, round_obj):
        organization = self.context["organization"]
        if round_obj.role.company.organization_id != organization.id:
            raise serializers.ValidationError("This round doesn't belong to your organization.")
        return round_obj


class ProctoringEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProctoringEvent
        fields = ["id", "event_type", "confidence", "note", "clip", "occurred_at"]
        read_only_fields = ["id", "occurred_at"]
