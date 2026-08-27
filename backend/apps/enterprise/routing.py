from django.urls import re_path

from .consumers import LiveCameraConsumer

websocket_urlpatterns = [
    re_path(r"^ws/enterprise/live/(?P<session_id>\d+)/$", LiveCameraConsumer.as_asgi()),
]
