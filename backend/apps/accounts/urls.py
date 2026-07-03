from django.urls import path

from .views import (
    GoogleAuthView,
    LoginView,
    MeView,
    RegisterView,
    ResendOTPView,
    VerifyEmailView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path("resend-otp/", ResendOTPView.as_view(), name="auth-resend-otp"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("google/", GoogleAuthView.as_view(), name="auth-google"),
    path("me/", MeView.as_view(), name="auth-me"),
]
