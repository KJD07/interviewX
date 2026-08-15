from django.urls import path

from .views import (
    ForgotPasswordView,
    GoogleAuthView,
    LoginView,
    MeView,
    RegisterView,
    ResendOTPView,
    ResetPasswordView,
    VerifyEmailView,
    _TempNetworkDiagView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path("resend-otp/", ResendOTPView.as_view(), name="auth-resend-otp"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("google/", GoogleAuthView.as_view(), name="auth-google"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="auth-reset-password"),
    path("_diag/", _TempNetworkDiagView.as_view(), name="auth-temp-diag"),
]
