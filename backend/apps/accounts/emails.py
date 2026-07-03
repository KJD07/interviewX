from django.conf import settings
from django.core.mail import send_mail


def send_otp_email(user, code: str) -> None:
    """Send the 6-digit verification code to the user's email."""
    subject = "Verify your InterviewX account"
    message = (
        f"Hi {user.username},\n\n"
        f"Your InterviewX verification code is: {code}\n\n"
        f"This code expires in 10 minutes. If you didn't request this, "
        f"you can safely ignore this email.\n\n"
        f"— InterviewX"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
