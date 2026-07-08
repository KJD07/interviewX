from django.urls import path

from .views import (
    ChatView,
    EndInterviewView,
    InterviewSessionDetailView,
    InterviewSessionListCreateView,
    ProgressView,
    RealInterviewReportView,
    StartInterviewView,
)

urlpatterns = [
    # existing CRUD
    path("", InterviewSessionListCreateView.as_view(), name="interview-list-create"),
    # Progress dashboard (must be registered before the <int:session_id>/
    # pattern is reachable via any client-side route, though the int
    # converter already prevents "progress" from matching it).
    path("progress/", ProgressView.as_view(), name="interview-progress"),
    path("<int:session_id>/", InterviewSessionDetailView.as_view(), name="interview-detail"),
    # Phase 5: AI engine
    path("start/", StartInterviewView.as_view(), name="interview-start"),
    path("<int:session_id>/chat/", ChatView.as_view(), name="interview-chat"),
    path("<int:session_id>/end/", EndInterviewView.as_view(), name="interview-end"),
    # Post-interview real-interview-report form (paid plans only)
    path("<int:session_id>/real-report/", RealInterviewReportView.as_view(), name="interview-real-report"),
]