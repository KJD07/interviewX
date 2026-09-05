"""
Root URL conf.
Phase 8: Subscriptions + PayU wired (/api/subscriptions/).
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView


def health_check(request):
    return JsonResponse({"status": "ok", "phase": 8})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", health_check),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/admin/", include("apps.accounts.admin_urls")),
    path("api/analytics/referral/", include("apps.accounts.insights_urls")),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/companies/", include("apps.companies.urls")),
    path("api/interviews/", include("apps.interviews.urls")),
    path("api/subscriptions/", include("apps.subscriptions.urls")),
    path("api/reviews/", include("apps.reviews.urls")),
    path("api/enterprise/", include("apps.enterprise.urls")),
]

# Local-disk MEDIA fallback (see MEDIA_ROOT in settings.py) only needs
# explicit serving in dev — when AWS_STORAGE_BUCKET_NAME is set, uploaded
# files are served straight from the bucket instead.
if settings.DEBUG and not settings.AWS_STORAGE_BUCKET_NAME:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)