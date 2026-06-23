"""
Root URL conf.
Phase 2: auth endpoints wired (/api/auth/register/, /api/auth/login/,
/api/auth/token/refresh/). Health check updated to reflect current phase.
"""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView


def health_check(request):
    return JsonResponse({"status": "ok", "phase": 2})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", health_check),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
]
