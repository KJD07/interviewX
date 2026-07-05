"""
Create one ready-to-login test user per subscription plan, so you can
manually check that free/pro/premium/max behave differently in the app
(dashboard visibility, AI insights, interview limits, etc.) without going
through Razorpay checkout.

USAGE
-----
    python manage.py create_test_users

Re-running is safe — existing test users are updated in place rather than
duplicated.

All users share the password below and are pre-verified so you can log in
immediately.
"""

from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User

PASSWORD = "TestPass123!"

# username, email, plan, interviews_this_month (to preview "almost at limit"
# / "limit reached" states too — tweak these anytime and re-run the command).
TEST_USERS = [
    ("test_free", "test.free@interviewx.dev", "free", 0),
    ("test_free_maxed", "test.free.maxed@interviewx.dev", "free", 2),  # limit reached
    ("test_pro", "test.pro@interviewx.dev", "pro", 5),
    ("test_premium", "test.premium@interviewx.dev", "premium", 12),
    ("test_max", "test.max@interviewx.dev", "max", 37),  # unlimited, should never block
]


class Command(BaseCommand):
    help = "Create/update one test user per subscription plan (free/pro/premium/max)."

    def handle(self, *args, **options):
        for username, email, plan, used in TEST_USERS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": email},
            )
            user.email = email
            user.set_password(PASSWORD)
            user.subscription_plan = plan
            user.interviews_this_month = used
            user.is_email_verified = True
            user.auth_provider = "email"
            user.subscription_end_date = (
                None if plan == "free" else timezone.now() + timedelta(days=30)
            )
            user.save()

            verb = "Created" if created else "Updated"
            self.stdout.write(
                self.style.SUCCESS(
                    f"{verb}: {email}  (plan={plan}, used={used})"
                )
            )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Done. Log in with any of the above emails."))
        self.stdout.write(f"Password for all test users: {PASSWORD}")