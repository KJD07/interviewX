"""
Root URL conf. Phase 0: admin only, so the project boots and
http://localhost:8000 returns something. API routes (/api/auth/,
/api/companies/, /api/interviews/, /api/subscriptions/) are wired in
as each app's urls.py is built (Phases 2-7), per Section 5 of the spec.
"""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import path


def health_check(request):
    return JsonResponse({"status": "ok", "phase": 0})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", health_check),
]
