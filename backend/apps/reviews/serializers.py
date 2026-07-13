from rest_framework import serializers

from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["id", "session", "rating", "comment", "plan_at_time", "created_at"]
        read_only_fields = ["id", "plan_at_time", "created_at"]

    def validate_session(self, session):
        request = self.context["request"]
        if session is not None and session.user_id != request.user.id:
            raise serializers.ValidationError("Session does not belong to you.")
        return session
