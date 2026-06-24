from django.urls import path

from .views import CompanyDetailView, CompanyListView, RoleListView, RoundDetailView, RoundListView

urlpatterns = [
    path("", CompanyListView.as_view(), name="company-list"),
    path("<int:company_id>/", CompanyDetailView.as_view(), name="company-detail"),
    path("<int:company_id>/roles/", RoleListView.as_view(), name="role-list"),
    path(
        "<int:company_id>/roles/<int:role_id>/rounds/",
        RoundListView.as_view(),
        name="round-list",
    ),
    path(
        "<int:company_id>/roles/<int:role_id>/rounds/<int:round_id>/",
        RoundDetailView.as_view(),
        name="round-detail",
    ),
]
