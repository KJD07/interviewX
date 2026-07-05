from rest_framework import serializers

from .models import InterviewSession, RealInterviewReport


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
            "insights",
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
        fields = ["id", "round", "status", "scores", "duration_minutes", "started_at", "ended_at"]
        read_only_fields = fields

class RoundEntrySerializer(serializers.Serializer):
    round_name = serializers.CharField(max_length=200)
    topics = serializers.CharField(max_length=2000, allow_blank=True)


class RealInterviewReportSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    session = serializers.PrimaryKeyRelatedField(read_only=True)
    rounds = serializers.ListField(child=serializers.DictField(), required=False, default=list)

    class Meta:
        model = RealInterviewReport
        fields = [
            "id",
            "session",
            "user",
            "had_recent_interview",
            "name",
            "email",
            "company_name",
            "role_title",
            "rounds",
            "can_provide_proof",
            "created_at",
        ]
        read_only_fields = ["id", "session", "user", "created_at"]

    def validate(self, attrs):
        if attrs.get("had_recent_interview") == RealInterviewReport.HadRecentInterview.NO:
            # Nothing else is required when the candidate says "No".
            return attrs

        # had_recent_interview == "yes" -> every other field is required.
        errors = {}
        for field in ("name", "email", "company_name", "role_title"):
            if not (attrs.get(field) or "").strip():
                errors[field] = "This field is required."

        rounds = attrs.get("rounds") or []
        if not rounds or not (rounds[0].get("round_name") or "").strip():
            errors["rounds"] = "At least one round (with a name) is required."
        else:
            validated_rounds = []
            for i, r in enumerate(rounds):
                round_name = (r.get("round_name") or "").strip()
                topics = (r.get("topics") or "").strip()
                if i == 0 and not round_name:
                    errors["rounds"] = "The first round's name is required."
                    break
                if round_name:
                    validated_rounds.append({"round_name": round_name, "topics": topics})
            attrs["rounds"] = validated_rounds

        if "can_provide_proof" not in self.initial_data:
            errors["can_provide_proof"] = "Please confirm whether you can provide proof."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        validated_data["session"] = self.context["session"]
        return super().create(validated_data)