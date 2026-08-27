from rest_framework import serializers

from apps.companies.models import InterviewQuestion, Role, Round

from .models import Organization, OrgCandidateInvite, ProctoringEvent


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "id", "name", "candidate_quota", "candidates_used",
            "contract_ends", "is_active", "live_camera_enabled",
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
    # Pending/Live/Finished/Expired for the dashboard — derived rather than
    # trusting invite.status alone, since invite.status only ever transitions
    # pending -> started (see OrgInviteStartView) and started -> completed is
    # driven by the linked InterviewSession's own status instead (see
    # apps.interviews.views._score_and_complete_session).
    candidate_status = serializers.SerializerMethodField()
    # Only populated once the linked session has actually been scored.
    scores = serializers.SerializerMethodField()

    class Meta:
        model = OrgCandidateInvite
        fields = [
            "id", "candidate_email", "round", "round_title", "role_title",
            "token", "status", "candidate_status", "scores", "session",
            "created_at", "expires_at",
        ]
        read_only_fields = [
            "id", "token", "status", "candidate_status", "scores", "session",
            "created_at", "round_title", "role_title",
        ]

    def get_candidate_status(self, obj):
        if obj.status == OrgCandidateInvite.Status.PENDING:
            return "pending"
        if obj.status == OrgCandidateInvite.Status.EXPIRED:
            return "expired"
        if obj.session_id and obj.session.status == "in_progress":
            return "live"
        return "finished"

    def get_scores(self, obj):
        if obj.session_id and obj.session.status == "completed":
            return obj.session.scores
        return None

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
