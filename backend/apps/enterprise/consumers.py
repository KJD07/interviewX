"""WebRTC signaling for the superuser-opt-in live camera viewer.

This consumer never touches actual video — it only relays small JSON
messages (SDP offers/answers, ICE candidates) between exactly two peers per
InterviewSession: the candidate's browser (role=publish) and an org member's
browser (role=view). The video itself flows peer-to-peer over WebRTC once
negotiation completes, so this stays cheap regardless of how long someone
watches.

Both roles join the same channel-layer group (one per session). A message
from one role is broadcast to the group and only re-delivered to connections
of the *other* role — there's normally exactly one of each, so this needs no
per-connection addressing.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.interviews.models import InterviewSession

from .models import OrgCandidateInvite, OrganizationMember


class LiveCameraConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]
        query = parse_qs(self.scope.get("query_string", b"").decode())
        self.role = (query.get("role") or [""])[0]
        user = self.scope.get("user")

        if self.role not in ("publish", "view") or user is None or not user.is_authenticated:
            await self.close(code=4401)
            return

        allowed = await self._is_allowed(user, self.session_id, self.role)
        if not allowed:
            await self.close(code=4403)
            return

        self.group_name = f"live_{self.session_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "live.message", "sender_role": self.role, "message": {"type": f"{self.role}-left"}},
            )
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "live.message", "sender_role": self.role, "message": content},
        )

    async def live_message(self, event):
        # Only forward messages that came from the *other* role — a
        # publisher's offer/ICE is for viewers, a viewer's answer/ICE/
        # viewer-join is for the publisher.
        if event["sender_role"] == self.role:
            return
        await self.send_json(event["message"])

    @database_sync_to_async
    def _is_allowed(self, user, session_id, role):
        try:
            session = InterviewSession.objects.select_related("user").get(pk=session_id)
        except (InterviewSession.DoesNotExist, ValueError):
            return False

        invite = OrgCandidateInvite.objects.filter(session=session).select_related("organization").first()
        if invite is None or not invite.organization.live_camera_enabled:
            return False

        if role == "publish":
            return session.user_id == user.id

        # role == "view": any member (admin or recruiter) of the org that
        # owns this invite, matching who can already see it on /enterprise.
        return OrganizationMember.objects.filter(
            organization_id=invite.organization_id, user=user
        ).exists()
