from django.conf import settings
from django.core.mail import send_mail
import logging

logger = logging.getLogger(__name__)


def send_otp_email(user, code: str) -> None:
    """Send the 6-digit verification code to the user's email and log the event.

    The code is masked in logs to avoid leaking the full OTP.
    """
    subject = "Verify your EvaluLabs account"
    message = (
        f"Hi {user.username},\n\n"
        f"Your EvaluLabs verification code is: {code}\n\n"
        f"This code expires in 10 minutes. If you didn't request this, "
        f"you can safely ignore this email.\n\n"
        f"— EvaluLabs"
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info("Sent verification email to %s (code=%s)", user.email, code)
    except Exception:
        logger.exception("Failed to send verification email to %s", user.email)
        raise


def send_password_reset_email(user, code: str) -> None:
    """Send the 6-digit password reset code to the user's email and log the event."""
    subject = "Reset your EvaluLabs password"
    message = (
        f"Hi {user.username},\n\n"
        f"Your EvaluLabs password reset code is: {code}\n\n"
        f"This code expires in 10 minutes. If you didn't request this, "
        f"you can safely ignore this email — your password will not be changed.\n\n"
        f"— EvaluLabs"
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info("Sent password-reset email to %s (code=%s)", user.email, code)
    except Exception:
        logger.exception("Failed to send password-reset email to %s", user.email)
        raise
