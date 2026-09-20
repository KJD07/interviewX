from django.urls import path

from .referral_views import (
    EnterpriseLeadCreateView,
    PartnerDashboardView,
    PartnerReferralCaptureView,
    PartnerRegisterView,
)
from .views import (
    OrgCandidateInviteBulkCreateView,
    OrgCandidateInviteListCreateView,
    OrgDashboardView,
    OrgInviteStartView,
    OrgQuestionTemplateView,
    OrgQuestionUploadView,
    ProctoringEventCreateView,
)

urlpatterns = [
    path("dashboard/", OrgDashboardView.as_view(), name="enterprise-dashboard"),
    path("question-bank/upload/", OrgQuestionUploadView.as_view(), name="enterprise-question-upload"),
    path("question-bank/template/", OrgQuestionTemplateView.as_view(), name="enterprise-question-template"),
    path("invites/", OrgCandidateInviteListCreateView.as_view(), name="enterprise-invite-list-create"),
    path("invites/bulk/", OrgCandidateInviteBulkCreateView.as_view(), name="enterprise-invite-bulk-create"),
    path("invites/<str:token>/start/", OrgInviteStartView.as_view(), name="enterprise-invite-start"),
    path(
        "sessions/<int:session_id>/proctoring-events/",
        ProctoringEventCreateView.as_view(),
        name="enterprise-proctoring-event-create",
    ),
    path("referrals/capture/", PartnerReferralCaptureView.as_view(), name="enterprise-referral-capture"),
    path("leads/", EnterpriseLeadCreateView.as_view(), name="enterprise-lead-create"),
    path("partner/register/", PartnerRegisterView.as_view(), name="enterprise-partner-register"),
    path("partner/dashboard/", PartnerDashboardView.as_view(), name="enterprise-partner-dashboard"),
]
