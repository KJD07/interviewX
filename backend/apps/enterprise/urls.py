from django.urls import path

from .referral_views import PartnerDashboardView, PartnerReferralCaptureView
from .views import (
    OrgCandidateInviteListCreateView,
    OrgDashboardView,
    OrgInviteStartView,
    OrgQuestionUploadView,
    ProctoringEventCreateView,
)

urlpatterns = [
    path("dashboard/", OrgDashboardView.as_view(), name="enterprise-dashboard"),
    path("question-bank/upload/", OrgQuestionUploadView.as_view(), name="enterprise-question-upload"),
    path("invites/", OrgCandidateInviteListCreateView.as_view(), name="enterprise-invite-list-create"),
    path("invites/<str:token>/start/", OrgInviteStartView.as_view(), name="enterprise-invite-start"),
    path(
        "sessions/<int:session_id>/proctoring-events/",
        ProctoringEventCreateView.as_view(),
        name="enterprise-proctoring-event-create",
    ),
    path("referrals/capture/", PartnerReferralCaptureView.as_view(), name="enterprise-referral-capture"),
    path("partner/dashboard/", PartnerDashboardView.as_view(), name="enterprise-partner-dashboard"),
]
