from django.urls import path

from .insights_api import AdminInsightsView, ReferralVisitView
from .product_analytics_api import ProductAnalyticsView

urlpatterns = [
    path("", ReferralVisitView.as_view()),
    path("dashboard/", AdminInsightsView.as_view()),
    path("product/", ProductAnalyticsView.as_view()),
]