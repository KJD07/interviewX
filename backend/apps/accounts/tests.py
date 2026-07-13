from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

User = get_user_model()


class SubscriptionCycleTests(TestCase):
    """Covers the bug where interviews_this_month never reset and lapsed
    paid subscriptions never downgraded (nothing ever called
    sync_subscription_state / there was no cron)."""

    def _make_user(self, **kwargs):
        defaults = dict(
            username="candidate",
            email="candidate@example.com",
            is_email_verified=True,
        )
        defaults.update(kwargs)
        user = User(**defaults)
        user.set_password("testpass123")
        user.save()
        return user

    def test_free_user_counter_resets_after_30_days(self):
        user = self._make_user(subscription_plan="free", interviews_this_month=2)
        user.current_cycle_start = timezone.now() - timedelta(days=31)
        user.save()

        changed = user.sync_subscription_state()

        self.assertIn("interviews_this_month", changed)
        self.assertEqual(user.interviews_this_month, 0)

    def test_counter_untouched_within_cycle(self):
        user = self._make_user(subscription_plan="free", interviews_this_month=1)
        user.current_cycle_start = timezone.now() - timedelta(days=5)
        user.save()

        changed = user.sync_subscription_state()

        self.assertEqual(changed, [])
        self.assertEqual(user.interviews_this_month, 1)

    def test_lapsed_paid_subscription_downgrades_to_free(self):
        user = self._make_user(
            subscription_plan="pro",
            subscription_end_date=timezone.now() - timedelta(days=1),
        )

        changed = user.sync_subscription_state()

        self.assertIn("subscription_plan", changed)
        self.assertEqual(user.subscription_plan, "free")
        self.assertIsNone(user.subscription_end_date)

    def test_active_paid_subscription_not_touched(self):
        user = self._make_user(
            subscription_plan="pro",
            subscription_end_date=timezone.now() + timedelta(days=10),
        )

        changed = user.sync_subscription_state()

        self.assertNotIn("subscription_plan", changed)
        self.assertEqual(user.subscription_plan, "pro")

    def test_me_endpoint_reflects_synced_state(self):
        user = self._make_user(
            subscription_plan="pro",
            subscription_end_date=timezone.now() - timedelta(days=1),
        )
        client = APIClient()
        client.force_authenticate(user=user)

        resp = client.get(reverse("auth-me"))

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["subscription_plan"], "free")


class AuthThrottleTests(TestCase):
    """Covers the missing-rate-limiting bug on /api/auth/*."""

    def test_register_endpoint_is_throttled_after_limit(self):
        client = APIClient()
        url = reverse("auth-register")
        last_status = None
        # settings.py sets the 'auth' scope to 10/min.
        for i in range(11):
            last_status = client.post(
                url,
                {
                    "username": f"user{i}",
                    "email": f"user{i}@example.com",
                    "password": "testpass123",
                    "password2": "testpass123",
                },
                format="json",
            ).status_code
        self.assertEqual(last_status, 429)
