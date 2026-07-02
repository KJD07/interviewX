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
            "duration_minutes",
            "started_at",
            "ended_at",
            "time_expired",
        ]
        read_only_fields = ["id", "user", "started_at", "duration_minutes", "time_expired"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class InterviewSessionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewSession
        fields = ["id", "round", "status", "duration_minutes", "started_at", "ended_at"]
        read_only_fields = fields