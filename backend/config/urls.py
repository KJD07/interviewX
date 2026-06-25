"""
Root URL conf.
Phase 4: InterviewSession endpoints wired (/api/interviews/...).
"""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView


def health_check(request):
    return JsonResponse({"status": "ok", "phase": 4})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", health_check),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/companies/", include("apps.companies.urls")),
    path("api/interviews/", include("apps.interviews.urls")),
]
