from django.urls import path

from .views import InterviewSessionDetailView, InterviewSessionListCreateView

urlpatterns = [
    path("", InterviewSessionListCreateView.as_view(), name="interview-list-create"),
    path("<int:session_id>/", InterviewSessionDetailView.as_view(), name="interview-detail"),
]
