from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.subscriptions.plans import effective_monthly_limit, effective_plan

from .emails import send_otp_email, send_password_reset_email
from .models import EmailOTP, PasswordResetOTP
from .throttles import AuthRateThrottle
from .serializers import (
    ForgotPasswordSerializer,
    GoogleAuthSerializer,
    LoginSerializer,
    RegisterSerializer,
    ResendOTPSerializer,
    ResetPasswordSerializer,
    VerifyOTPSerializer,
)

User = get_user_model()
import logging

logger = logging.getLogger(__name__)


def _token_response(user) -> dict:
    """Return access + refresh tokens for a given user."""
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "subscription_plan": effective_plan(user),
            "monthly_limit": effective_monthly_limit(user),
            "is_email_verified": user.is_email_verified,
            "auth_provider": user.auth_provider,
        },
    }


def _issue_otp(user) -> None:
    otp = EmailOTP.generate_for_user(user)
    try:
        send_otp_email(user, otp.code)
        logger.info("Issued email OTP for %s (code=%s)", user.email, otp.code)
    except Exception:
        logger.exception("Failed to send OTP email to %s", user.email)
        raise


class RegisterView(APIView):
    """
    Creates the account in an UNVERIFIED state and emails a 6-digit OTP.
    No tokens are issued here — the account can't be used to log in until
    the code is confirmed via VerifyEmailView. This is what closes the
    "any fake email can log in" hole: the email now has to prove it can
    receive mail before it becomes a usable account.
    """

    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        _issue_otp(user)

        return Response(
            {
                "detail": "Account created. Enter the code we emailed you to verify your address.",
                "email": user.email,
                "requires_verification": True,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    """POST /api/auth/verify-email/  { email, code } -> tokens on success."""

    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"].lower()
        code = serializer.validated_data["code"]

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"detail": "Invalid email or code."}, status=status.HTTP_400_BAD_REQUEST)

        if user.is_email_verified:
            return Response(_token_response(user), status=status.HTTP_200_OK)

        otp = EmailOTP.objects.filter(user=user, is_used=False).order_by("-created_at").first()
        if not otp:
            logger.warning("Verify attempt for %s: no active OTP", email)
            return Response(
                {"detail": "No active code found. Request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.is_expired:
            logger.warning("Verify attempt for %s: expired OTP", email)
            return Response({"detail": "Code expired. Request a new one."}, status=status.HTTP_400_BAD_REQUEST)

        if otp.attempts >= EmailOTP.MAX_ATTEMPTS:
            logger.warning("Verify attempt for %s: too many incorrect attempts", email)
            return Response(
                {"detail": "Too many incorrect attempts. Request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.code != code:
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            remaining = EmailOTP.MAX_ATTEMPTS - otp.attempts
            logger.warning("Incorrect OTP submitted for %s (attempts=%d)", email, otp.attempts)
            return Response(
                {"detail": f"Incorrect code. {remaining} attempt(s) left."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp.is_used = True
        otp.save(update_fields=["is_used"])
        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])
        logger.info("Email verified for %s", email)

        return Response(_token_response(user), status=status.HTTP_200_OK)


class ResendOTPView(APIView):
    """POST /api/auth/resend-otp/  { email }"""

    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ResendOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"].lower()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Don't leak whether an email is registered.
            return Response({"detail": "If that account exists, a new code has been sent."})
        if user.is_email_verified:
            return Response({"detail": "This account is already verified. Please log in."})
        logger.info("Resend OTP requested for %s", email)
        _issue_otp(user)
        return Response({"detail": "A new verification code has been sent."})


class ForgotPasswordView(APIView):
    """POST /api/auth/forgot-password/  { email } -> always a generic response,
    never revealing whether the email is registered."""

    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"].lower()
        generic_response = Response(
            {"detail": "If that account exists, a password reset code has been sent."}
        )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return generic_response

        if user.auth_provider == "google" and not user.has_usable_password():
            # Nothing to reset — don't leak this, just don't send a code.
            return generic_response
        otp = PasswordResetOTP.generate_for_user(user)
        send_password_reset_email(user, otp.code)
        logger.info("Password-reset OTP issued for %s (code=%s)", user.email, otp.code)
        return generic_response


class ResetPasswordView(APIView):
    """POST /api/auth/reset-password/  { email, code, new_password, new_password2 }
    -> tokens on success."""

    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"].lower()
        code = serializer.validated_data["code"]
        new_password = serializer.validated_data["new_password"]

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"detail": "Invalid email or code."}, status=status.HTTP_400_BAD_REQUEST)

        otp = (
            PasswordResetOTP.objects.filter(user=user, is_used=False)
            .order_by("-created_at")
            .first()
        )
        if not otp:
            return Response(
                {"detail": "No active code found. Request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.is_expired:
            return Response({"detail": "Code expired. Request a new one."}, status=status.HTTP_400_BAD_REQUEST)

        if otp.attempts >= PasswordResetOTP.MAX_ATTEMPTS:
            return Response(
                {"detail": "Too many incorrect attempts. Request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.code != code:
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            remaining = PasswordResetOTP.MAX_ATTEMPTS - otp.attempts
            logger.warning("Incorrect password-reset OTP for %s (attempts=%d)", email, otp.attempts)
            return Response(
                {"detail": f"Incorrect code. {remaining} attempt(s) left."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp.is_used = True
        otp.save(update_fields=["is_used"])

        logger.info("Password reset completed for %s", email)

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response(_token_response(user), status=status.HTTP_200_OK)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]

        # Look up by email, then authenticate with the username Django expects
        try:
            user_obj = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user_obj.auth_provider == "google" and not user_obj.has_usable_password():
            return Response(
                {"detail": "This account uses Google Sign-In. Continue with Google instead."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = authenticate(request, username=user_obj.username, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_email_verified:
            logger.info("Login attempt for unverified email %s: issuing OTP", user.email)
            _issue_otp(user)
            return Response(
                {
                    "detail": "Please verify your email before logging in. We've sent you a new code.",
                    "code": "EMAIL_NOT_VERIFIED",
                    "email": user.email,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(_token_response(user), status=status.HTTP_200_OK)


class GoogleAuthView(APIView):
    """
    POST /api/auth/google/  { id_token }

    Verifies the Google-issued ID token server-side (audience + signature +
    issuer, via Google's own libraries), then logs the user in — creating
    the account on first sign-in. Google has already proven the email is
    real, so these accounts are marked verified immediately.
    """

    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        token = serializer.validated_data["id_token"]

        if not settings.GOOGLE_CLIENT_ID:
            return Response(
                {"detail": "Google Sign-In is not configured on the server."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        try:
            idinfo = google_id_token.verify_oauth2_token(
                token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
            )
        except ValueError:
            return Response({"detail": "Invalid Google token."}, status=status.HTTP_401_UNAUTHORIZED)

        if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            return Response({"detail": "Invalid token issuer."}, status=status.HTTP_401_UNAUTHORIZED)

        if not idinfo.get("email_verified", False):
            return Response(
                {"detail": "Your Google account email is not verified."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        google_sub = idinfo["sub"]
        email = idinfo["email"].lower()

        user = User.objects.filter(google_sub=google_sub).first()
        if user is None:
            # Link to an existing email/password account if one exists,
            # otherwise create a brand new account.
            user = User.objects.filter(email__iexact=email).first()
            if user is None:
                base_username = email.split("@")[0]
                username = base_username
                suffix = 1
                while User.objects.filter(username=username).exists():
                    suffix += 1
                    username = f"{base_username}{suffix}"
                user = User(username=username, email=email)
                user.set_unusable_password()

            user.google_sub = google_sub
            user.auth_provider = "google"
            user.is_email_verified = True
            user.save()

        return Response(_token_response(user), status=status.HTTP_200_OK)


class MeView(APIView):
    """GET /api/auth/me/ — return fresh user data (including interviews_this_month)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        changed_fields = user.sync_subscription_state()
        if changed_fields:
            user.save(update_fields=changed_fields)
        is_sponsored = user.sponsorship_campaign_id is not None
        return Response(
            {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "subscription_plan": effective_plan(user),
                "monthly_limit": effective_monthly_limit(user),
                "interviews_this_month": (
                    user.sponsorship_interviews_used
                    if is_sponsored
                    else user.interviews_this_month
                ),
                "bonus_interviews": user.bonus_interviews,
                "is_email_verified": user.is_email_verified,
                "auth_provider": user.auth_provider,
            }
        )


class _TempNetworkDiagView(APIView):
    """TEMPORARY — diagnoses whether outbound SMTP is blocked at the
    Railway network level vs. blocked specifically by spacemail. Not part
    of the product; remove after diagnosis."""

    permission_classes = [AllowAny]

    def get(self, request):
        import socket
        import time

        if request.query_params.get("token") != "diag-9f3a1c-temp":
            return Response(status=status.HTTP_404_NOT_FOUND)

        targets = [
            ("spacemail:587", "mail.spacemail.com", 587),
            ("spacemail:465", "mail.spacemail.com", 465),
            ("spacemail:25", "mail.spacemail.com", 25),
            ("gmail:587", "smtp.gmail.com", 587),
            ("gmail:465", "smtp.gmail.com", 465),
        ]
        results = {}
        for label, host, port in targets:
            start = time.monotonic()
            try:
                with socket.create_connection((host, port), timeout=6):
                    results[label] = {"ok": True, "seconds": round(time.monotonic() - start, 2)}
            except Exception as e:
                results[label] = {
                    "ok": False,
                    "error": f"{type(e).__name__}: {e}",
                    "seconds": round(time.monotonic() - start, 2),
                }
        return Response(results)
