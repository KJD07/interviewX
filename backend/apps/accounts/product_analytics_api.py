from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .product_analytics import build_product_analytics


class CanViewAnalytics(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "can_view_analytics", False)
        )


class ProductAnalyticsView(APIView):
    """GET /api/analytics/product/?period=day|week|month|quarter&product=all|practice|enterprise"""

    permission_classes = [IsAuthenticated, CanViewAnalytics]

    def get(self, request):
        period = str(request.query_params.get("period", "week")).lower()
        product = str(request.query_params.get("product", "all")).lower()
        return Response(build_product_analytics(period, product))
