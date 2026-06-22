from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    # Custom User model (subscription_plan, interviews_this_month, etc.)
    # is added here in Phase 1/2 — do not migrate this app until then.
