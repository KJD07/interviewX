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
    list_display = (
        "username",
        "email",
        "subscription_plan",
        "interviews_this_month",
        "is_staff",
    )
    list_filter = BaseUserAdmin.list_filter + ("subscription_plan",)  # type: ignore[operator]
