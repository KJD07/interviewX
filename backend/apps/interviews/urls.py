from django.urls import path

from .views import (
    ChatView,
    EndInterviewView,
    InterviewSessionDetailView,
    InterviewSessionListCreateView,
    RealInterviewReportView,
    StartInterviewView,
)

urlpatterns = [
    # existing CRUD
    path("", InterviewSessionListCreateView.as_view(), name="interview-list-create"),
    path("<int:session_id>/", InterviewSessionDetailView.as_view(), name="interview-detail"),
    # Phase 5: AI engine
    path("start/", StartInterviewView.as_view(), name="interview-start"),
    path("<int:session_id>/chat/", ChatView.as_view(), name="interview-chat"),
    path("<int:session_id>/end/", EndInterviewView.as_view(), name="interview-end"),
    # Post-interview real-interview-report form (paid plans only)
    path("<int:session_id>/real-report/", RealInterviewReportView.as_view(), name="interview-real-report"),
]