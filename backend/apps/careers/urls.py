from django.urls import path

from .views import JobDetailView, JobListView, PracticeQuestionListView, PracticeValidateView, ResumeCheckView

urlpatterns = [
    path("jobs/", JobListView.as_view(), name="careers-jobs"),
    path("jobs/<int:job_id>/", JobDetailView.as_view(), name="careers-job-detail"),
    path("jobs/<int:job_id>/resume-check/", ResumeCheckView.as_view(), name="careers-resume-check"),
    path("practice/questions/", PracticeQuestionListView.as_view(), name="careers-practice-questions"),
    path("practice/validate/", PracticeValidateView.as_view(), name="careers-practice-validate"),
]
