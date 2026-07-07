from rest_framework import serializers

from .models import Company, InterviewQuestion, Role, Round


class InterviewQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewQuestion
        fields = ["id", "question_text", "question_type", "ideal_answer", "source_url"]


class RoundSerializer(serializers.ModelSerializer):
    questions = InterviewQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Round
        fields = ["id", "title", "order", "questions"]


class RoleSerializer(serializers.ModelSerializer):
    rounds = RoundSerializer(many=True, read_only=True)

    class Meta:
        model = Role
        fields = ["id", "title", "rounds"]


class CompanySerializer(serializers.ModelSerializer):
    roles = RoleSerializer(many=True, read_only=True)

    class Meta:
        model = Company
        fields = ["id", "name", "tone_style", "description", "is_free", "roles"]


class CompanyListSerializer(serializers.ModelSerializer):
    """Flat serializer for list endpoint — no nested roles (avoids large payloads)."""

    class Meta:
        model = Company
        fields = ["id", "name", "tone_style", "description", "is_free"]
