from rest_framework import serializers

from .models import InterviewSession


class InterviewSessionSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = InterviewSession
        fields = [
            "id",
            "user",
            "round",
            "status",
            "transcript",
            "scores",
            "feedback",
            "started_at",
            "ended_at",
        ]
        read_only_fields = ["id", "user", "started_at"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class InterviewSessionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewSession
        fields = ["id", "round", "status", "started_at", "ended_at"]
        read_only_fields = fields