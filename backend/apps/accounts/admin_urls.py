from django.urls import path

from .admin_api import (
    AdminActionView,
    AdminDeletePreviewView,
    AdminHistoryView,
    AdminLookupView,
    AdminModelView,
    AdminSchemaView,
    AdminUploadSpreadsheetView,
    AdminUploadSponsorshipEmailsView,
)

urlpatterns = [
    path("schema/", AdminSchemaView.as_view()),
    # Fixed-path endpoints must come before the generic <model_name>/<action_name>/
    # catch-all below, since e.g. "upload-spreadsheet" would otherwise also
    # match that pattern as an (unrecognized) action name.
    path("companies/company/upload-spreadsheet/", AdminUploadSpreadsheetView.as_view()),
    path(
        "subscriptions/sponsorshipcampaign/<int:campaign_id>/upload-emails/",
        AdminUploadSponsorshipEmailsView.as_view(),
    ),
    path("<str:app_label>/<str:model_name>/lookup/", AdminLookupView.as_view()),
    path("<str:app_label>/<str:model_name>/<int:object_id>/history/", AdminHistoryView.as_view()),
    path("<str:app_label>/<str:model_name>/<int:object_id>/delete-preview/", AdminDeletePreviewView.as_view()),
    path("<str:app_label>/<str:model_name>/", AdminModelView.as_view()),
    path("<str:app_label>/<str:model_name>/<int:object_id>/", AdminModelView.as_view()),
    path("<str:app_label>/<str:model_name>/<str:action_name>/", AdminActionView.as_view()),
]
