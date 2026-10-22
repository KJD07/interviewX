from django.urls import path

from .views import (
    ApplicationDetailView, ApplicationListView, JobDetailView, JobListView, JobSaveView, PracticeQuestionListView,
    PracticeValidateView, ProfileResumeView, ProfileView, ResumeCheckView, SavedJobListView,
)

urlpatterns = [
    path("jobs/", JobListView.as_view(), name="careers-jobs"),
    path("jobs/<int:job_id>/", JobDetailView.as_view(), name="careers-job-detail"),
    path("jobs/<int:job_id>/save/", JobSaveView.as_view(), name="careers-job-save"),
    path("jobs/<int:job_id>/resume-check/", ResumeCheckView.as_view(), name="careers-resume-check"),
    path("saved/", SavedJobListView.as_view(), name="careers-saved"),
    path("applications/", ApplicationListView.as_view(), name="careers-applications"),
    path("applications/<int:pk>/", ApplicationDetailView.as_view(), name="careers-application-detail"),
    path("profile/", ProfileView.as_view(), name="careers-profile"),
    path("profile/resume/", ProfileResumeView.as_view(), name="careers-profile-resume"),
    path("practice/questions/", PracticeQuestionListView.as_view(), name="careers-practice-questions"),
    path("practice/validate/", PracticeValidateView.as_view(), name="careers-practice-validate"),
]
