from rest_framework.throttling import ScopedRateThrottle


class AuthRateThrottle(ScopedRateThrottle):
    """Rate-limits unauthenticated auth endpoints (register, verify-OTP,
    resend-OTP, login, Google auth) against brute-force / credential-
    stuffing / OTP-spam. Views using this must also set
    `throttle_scope = "auth"`, which maps to the rate defined in
    settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']."""
