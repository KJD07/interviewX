import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# get_asgi_application() must run before importing anything that touches
# models (it populates the app registry) — apps.enterprise.routing imports
# its consumer, which imports models, so it's imported only after this line.
django_asgi_app = get_asgi_application()

from apps.enterprise.routing import websocket_urlpatterns  # noqa: E402
from apps.enterprise.ws_auth import JWTAuthMiddlewareStack  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)
