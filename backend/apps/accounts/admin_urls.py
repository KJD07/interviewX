from django.urls import path

from .admin_api import AdminActionView, AdminModelView, AdminSchemaView

urlpatterns = [
    path("schema/", AdminSchemaView.as_view()),
    path("<str:app_label>/<str:model_name>/", AdminModelView.as_view()),
    path("<str:app_label>/<str:model_name>/<int:object_id>/", AdminModelView.as_view()),
    path("<str:app_label>/<str:model_name>/<str:action_name>/", AdminActionView.as_view()),
]