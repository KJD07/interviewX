from django.urls import path

from .insights_api import AdminInsightsView, ReferralVisitView

urlpatterns = [
    path("", ReferralVisitView.as_view()),
    path("dashboard/", AdminInsightsView.as_view()),
]