from rest_framework import serializers

from apps.companies.models import InterviewQuestion

from .models import InterviewSession, RealInterviewReport

# Per-round cap on candidate-submitted questions, kept small since these are
# reviewed by hand by an admin before they're trusted or rewarded.
MAX_QUESTIONS_PER_ROUND = 10
MAX_QUESTION_LENGTH = 1000


class InterviewSessionSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    company_name = serializers.CharField(source="round.role.company.name", read_only=True)
    role_title = serializers.CharField(source="round.role.title", read_only=True)
    # Whether this session belongs to an org's candidate pipeline (see
    # apps.enterprise.OrgCandidateInvite) — the frontend uses this to decide
    # whether to activate webcam-based proctoring at all. Consumer sessions
    # always resolve False here.
    is_proctored = serializers.SerializerMethodField()

    class Meta:
        model = InterviewSession
        fields = [
            "id",
            "user",
            "round",
            "company_name",
            "role_title",
            "status",
            "transcript",
            "scores",
            "feedback",
            "insights",
            "duration_minutes",
            "started_at",
            "ended_at",
            "time_expired",
            "is_proctored",
        ]
        read_only_fields = ["id", "user", "started_at", "duration_minutes", "time_expired"]

    def get_is_proctored(self, obj):
        return obj.org_invite.exists()

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class InterviewSessionListSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="round.role.company.name", read_only=True)
    role_title = serializers.CharField(source="round.role.title", read_only=True)

    class Meta:
        model = InterviewSession
        fields = ["id", "round", "company_name", "role_title", "status", "scores", "duration_minutes", "started_at", "ended_at"]
        read_only_fields = fields

class RoundEntrySerializer(serializers.Serializer):
    round_name = serializers.CharField(max_length=200)
    topics = serializers.CharField(max_length=2000, allow_blank=True)
    questions = serializers.ListField(
        child=serializers.CharField(max_length=MAX_QUESTION_LENGTH, allow_blank=False),
        required=False,
        default=list,
    )


class RealInterviewReportSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    # Optional: which of the user's own completed sessions (if any) this
    # report was submitted alongside, for context only. Validated against
    # the requesting user in validate_session below.
    session = serializers.PrimaryKeyRelatedField(
        queryset=InterviewSession.objects.all(), required=False, allow_null=True
    )
    rounds = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    questions = serializers.ListField(
        child=serializers.CharField(max_length=MAX_QUESTION_LENGTH, allow_blank=False),
        required=False,
        default=list,
        write_only=True,
    )

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
            "round_name",
            "questions",
            "rounds",
            "can_provide_proof",
            "status",
            "reviewed_at",
            "created_at",
        ]
        read_only_fields = ["id", "user", "status", "reviewed_at", "created_at"]

    def validate_session(self, session):
        if session is None:
            return session
        request = self.context["request"]
        if session.user_id != request.user.id:
            raise serializers.ValidationError("Not found.")
        if session.status != InterviewSession.Status.COMPLETED:
            raise serializers.ValidationError("Session is not completed yet.")
        return session

    def validate(self, attrs):
        if attrs.get("had_recent_interview") == RealInterviewReport.HadRecentInterview.NO:
            # Nothing else is required when the candidate says "No".
            return attrs

        # had_recent_interview == "yes" -> every other field is required.
        errors = {}
        for field in ("name", "email", "company_name", "role_title", "round_name"):
            if not (attrs.get(field) or "").strip():
                errors[field] = "This field is required."

        questions = [
            q.strip()
            for q in attrs.get("questions", [])
            if isinstance(q, str) and q.strip()
        ][:MAX_QUESTIONS_PER_ROUND]

        round_name = (attrs.get("round_name") or "").strip()
        rounds = attrs.get("rounds") or []
        if not rounds:
            rounds = [{"round_name": round_name, "topics": "", "questions": questions}]
        else:
            validated_rounds = []
            for i, r in enumerate(rounds):
                current_round_name = (r.get("round_name") or round_name).strip()
                topics = (r.get("topics") or "").strip()
                if i == 0 and not current_round_name:
                    errors["rounds"] = "At least one round (with a name) is required."
                    break
                if current_round_name:
                    round_questions = [
                        q.strip()
                        for q in (r.get("questions") or questions)
                        if isinstance(q, str) and q.strip()
                    ][:MAX_QUESTIONS_PER_ROUND]
                    validated_rounds.append(
                        {"round_name": current_round_name, "topics": topics, "questions": round_questions}
                    )
            rounds = validated_rounds

        attrs["rounds"] = rounds
        attrs.pop("questions", None)

        if "can_provide_proof" not in self.initial_data:
            errors["can_provide_proof"] = "Please confirm whether you can provide proof."

        if not errors:
            company_name = (attrs.get("company_name") or "").strip()
            if (
                RealInterviewReport.objects.filter(
                    user=self.context["request"].user,
                    had_recent_interview=RealInterviewReport.HadRecentInterview.YES,
                    company_name__iexact=company_name,
                    round_name__iexact=round_name,
                ).exists()
            ):
                errors["round_name"] = "You already submitted this round for this company."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        report = super().create(validated_data)

        questions_to_create = [
            InterviewQuestion(
                submitted_by=report.user,
                source_report=report,
                submitted_company_name=report.company_name,
                submitted_role_title=report.role_title,
                submitted_round_name=r.get("round_name", ""),
                question_text=q,
                question_type="other",
                status=InterviewQuestion.Status.PENDING,
            )
            for r in (report.rounds or [])
            for q in r.get("questions", [])
        ]
        if questions_to_create:
            InterviewQuestion.objects.bulk_create(questions_to_create)

        return report