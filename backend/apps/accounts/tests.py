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


class SponsorshipTests(TestCase):
    """Covers institutional sponsorship campaigns: lazy attach/expire/roll in
    sync_subscription_state(), and that the interview cap is enforced
    independently of the user's own plan/bonus credits."""

    def _make_user(self, **kwargs):
        defaults = dict(
            username="candidate",
            email="candidate@thapar.edu",
            is_email_verified=True,
        )
        defaults.update(kwargs)
        user = User(**defaults)
        user.set_password("testpass123")
        user.save()
        return user

    def _make_campaign(self, **kwargs):
        from apps.subscriptions.models import SponsorshipCampaign

        defaults = dict(
            name="Thapar University Pilot",
            email_domain="thapar.edu",
            granted_plan="premium",
            interview_limit=20,
            cycle_days=30,
            sponsor_covers_until=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        defaults.update(kwargs)
        return SponsorshipCampaign.objects.create(**defaults)

    def test_auto_attaches_on_first_sync_for_matching_domain(self):
        campaign = self._make_campaign()
        user = self._make_user()

        changed = user.sync_subscription_state()

        self.assertIn("sponsorship_campaign", changed)
        self.assertEqual(user.sponsorship_campaign_id, campaign.id)
        self.assertEqual(user.sponsorship_interviews_used, 0)

    def test_no_attach_for_non_matching_domain(self):
        self._make_campaign(email_domain="thapar.edu")
        user = self._make_user(email="candidate@other.edu")

        changed = user.sync_subscription_state()

        self.assertNotIn("sponsorship_campaign", changed)
        self.assertIsNone(user.sponsorship_campaign_id)

    def test_clears_when_coverage_lapses(self):
        campaign = self._make_campaign(
            sponsor_covers_until=timezone.now() - timedelta(days=1)
        )
        user = self._make_user(
            sponsorship_campaign=campaign,
            sponsorship_cycle_start=timezone.now() - timedelta(days=40),
            sponsorship_interviews_used=15,
        )

        changed = user.sync_subscription_state()

        self.assertIn("sponsorship_campaign", changed)
        self.assertIsNone(user.sponsorship_campaign_id)
        self.assertEqual(user.sponsorship_interviews_used, 0)

    def test_clears_when_campaign_deactivated(self):
        campaign = self._make_campaign(is_active=False)
        user = self._make_user(
            sponsorship_campaign=campaign,
            sponsorship_cycle_start=timezone.now(),
        )

        changed = user.sync_subscription_state()

        self.assertIn("sponsorship_campaign", changed)
        self.assertIsNone(user.sponsorship_campaign_id)

    def test_rolls_cycle_after_cycle_days_while_covered(self):
        campaign = self._make_campaign(cycle_days=30)
        user = self._make_user(
            sponsorship_campaign=campaign,
            sponsorship_cycle_start=timezone.now() - timedelta(days=31),
            sponsorship_interviews_used=18,
        )

        changed = user.sync_subscription_state()

        self.assertIn("sponsorship_interviews_used", changed)
        self.assertEqual(user.sponsorship_interviews_used, 0)
        self.assertEqual(user.sponsorship_campaign_id, campaign.id)

    def test_start_interview_blocked_after_sponsorship_cap_regardless_of_bonus(self):
        from apps.companies.models import Company, Role, Round

        campaign = self._make_campaign(interview_limit=1)
        user = self._make_user(
            sponsorship_campaign=campaign,
            sponsorship_cycle_start=timezone.now(),
            sponsorship_interviews_used=1,
            bonus_interviews=5,
        )
        company = Company.objects.create(
            name="TestCo", kind=Company.Kind.COMPANY, tone_style="formal_strict"
        )
        role = Role.objects.create(company=company, title="SDE")
        round_obj = Round.objects.create(role=role, title="Technical")

        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.post(
            reverse("interview-start"), {"round_id": round_obj.id}, format="json"
        )

        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.data["code"], "plan_limit_reached")


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
