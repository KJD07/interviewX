import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_candidate_invite_email(invite) -> None:
    """Email a candidate their org interview invite link, mirroring
    apps.accounts.emails.send_otp_email's send-and-log pattern."""
    round_obj = invite.round
    organization = invite.organization
    invite_url = f"{settings.FRONTEND_URL.rstrip('/')}/enterprise/invite/{invite.token}"

    subject = f"You're invited to interview with {organization.name}"
    message = (
        f"Hi,\n\n"
        f"{organization.name} has invited you to complete an interview for "
        f"{round_obj.role.title} — {round_obj.title}.\n\n"
        f"Start your interview here: {invite_url}\n\n"
        f"This link expires on {invite.expires_at:%Y-%m-%d %H:%M} UTC and can "
        f"only be used by the email address it was sent to ({invite.candidate_email}).\n\n"
        f"— EvaluLabs"
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invite.candidate_email],
            fail_silently=False,
        )
        logger.info("Sent org invite email to %s (invite=%s)", invite.candidate_email, invite.pk)
    except Exception:
        # Invite is already persisted — a stalled SMTP host (common in local
        # Docker, and on hosts that block outbound SMTP) must not 500 the
        # create endpoint. The recruiter still sees the candidate in the
        # dashboard; the link is /enterprise/invite/<token>.
        logger.exception("Failed to send org invite email to %s", invite.candidate_email)
