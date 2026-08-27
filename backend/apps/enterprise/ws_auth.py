"""JWT auth for Channels WebSocket connections.

Browsers can't set an Authorization header on a WebSocket handshake, so the
frontend passes the same access token it already uses for REST calls as a
`?token=` query param instead. This middleware validates it with the same
SimpleJWT machinery DRF uses for HTTP and attaches the resulting user to the
connection scope, mirroring what JWTAuthentication does per-request.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _get_user_from_token(token: str):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        validated = AccessToken(token)
        user = User.objects.get(pk=validated["user_id"])
    except (TokenError, KeyError, User.DoesNotExist):
        return AnonymousUser()
    return user


class JWTAuthMiddleware:
    """ASGI middleware — reads ?token=<access JWT> and sets scope["user"]."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        token = parse_qs(query_string).get("token", [None])[0]
        scope["user"] = await _get_user_from_token(token) if token else AnonymousUser()
        return await self.app(scope, receive, send)


def JWTAuthMiddlewareStack(app):
    return JWTAuthMiddleware(app)
