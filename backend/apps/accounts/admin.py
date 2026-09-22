from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Extend Django's built-in UserAdmin with our extra fields."""

    fieldsets = BaseUserAdmin.fieldsets + (  # type: ignore[operator]
        (
            "Subscription",
            {
                "fields": (
                    "subscription_plan",
                    "interviews_this_month",
                    "subscription_end_date",
                )
            },
        ),
    )
    fieldsets = fieldsets + (
        (
            "Verification",
            {"fields": ("is_email_verified", "auth_provider", "google_sub")},
        ),
    )
    list_display = (
        "username",
        "email",
        "subscription_plan",
        "interviews_this_month",
        "is_email_verified",
        "auth_provider",
        "is_staff",
        "can_view_analytics",
    )
    list_filter = BaseUserAdmin.list_filter + (  # type: ignore[operator]
        "subscription_plan",
        "is_email_verified",
        "auth_provider",
        "can_view_analytics",
    )
    fieldsets = fieldsets + (
        (
            "Product analytics",
            {"fields": ("can_view_analytics",)},
        ),
    )
