from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
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

    def test_login_updates_last_login_for_active_user(self):
        user = self._make_user(email="login@example.com", username="loginuser")
        user.set_password("testpass123")
        user.save()

        client = APIClient()
        response = client.post(
            reverse("auth-login"),
            {"email": "login@example.com", "password": "testpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertIsNotNone(user.last_login)


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

    def _add_member(self, campaign, email):
        from apps.subscriptions.models import SponsorshipMember

        return SponsorshipMember.objects.create(campaign=campaign, email=email)

    def test_attaches_via_uploaded_email_on_a_non_matching_domain(self):
        campaign = self._make_campaign(email_domain="")
        self._add_member(campaign, "candidate@gmail.com")
        user = self._make_user(email="candidate@gmail.com")

        changed = user.sync_subscription_state()

        self.assertIn("sponsorship_campaign", changed)
        self.assertEqual(user.sponsorship_campaign_id, campaign.id)

    def test_uploaded_email_is_matched_case_insensitively(self):
        campaign = self._make_campaign(email_domain="")
        self._add_member(campaign, "Candidate@Gmail.com")
        user = self._make_user(email="candidate@gmail.com")

        user.sync_subscription_state()

        self.assertEqual(user.sponsorship_campaign_id, campaign.id)

    def test_uploaded_email_wins_over_a_domain_campaign(self):
        domain_campaign = self._make_campaign(
            name="Thapar blanket", email_domain="thapar.edu", granted_plan="pro"
        )
        list_campaign = self._make_campaign(
            name="Thapar toppers", email_domain="", granted_plan="max"
        )
        self._add_member(list_campaign, "candidate@thapar.edu")
        user = self._make_user(email="candidate@thapar.edu")

        user.sync_subscription_state()

        self.assertEqual(user.sponsorship_campaign_id, list_campaign.id)
        self.assertNotEqual(user.sponsorship_campaign_id, domain_campaign.id)

    def test_email_uploaded_before_the_user_registers_attaches_on_first_sync(self):
        campaign = self._make_campaign(email_domain="")
        self._add_member(campaign, "future@gmail.com")

        # Registration happens after the upload — no signup hook exists, the
        # user is picked up on their first authenticated request.
        user = self._make_user(email="future@gmail.com")
        user.sync_subscription_state()

        self.assertEqual(user.sponsorship_campaign_id, campaign.id)

    def test_no_attach_when_the_member_campaign_has_lapsed(self):
        campaign = self._make_campaign(
            email_domain="", sponsor_covers_until=timezone.now() - timedelta(days=1)
        )
        self._add_member(campaign, "candidate@gmail.com")
        user = self._make_user(email="candidate@gmail.com")

        changed = user.sync_subscription_state()

        self.assertNotIn("sponsorship_campaign", changed)
        self.assertIsNone(user.sponsorship_campaign_id)

    def test_no_attach_when_the_member_campaign_is_inactive(self):
        campaign = self._make_campaign(email_domain="", is_active=False)
        self._add_member(campaign, "candidate@gmail.com")
        user = self._make_user(email="candidate@gmail.com")

        user.sync_subscription_state()

        self.assertIsNone(user.sponsorship_campaign_id)

    def test_uploaded_email_grants_the_campaign_plan_and_limit(self):
        from apps.subscriptions.plans import effective_monthly_limit, effective_plan

        campaign = self._make_campaign(
            email_domain="", granted_plan="max", interview_limit=7
        )
        self._add_member(campaign, "candidate@gmail.com")
        user = self._make_user(email="candidate@gmail.com", subscription_plan="free")

        user.sync_subscription_state()

        self.assertEqual(effective_plan(user), "max")
        self.assertEqual(effective_monthly_limit(user), 7)
        # The user's own plan field is never touched by a campaign.
        self.assertEqual(user.subscription_plan, "free")

    def test_a_blank_domain_campaign_does_not_cover_everyone(self):
        self._make_campaign(email_domain="")
        user = self._make_user(email="stranger@elsewhere.com")

        user.sync_subscription_state()

        self.assertIsNone(user.sponsorship_campaign_id)

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


class PasswordResetTests(TestCase):
    """Covers the forgot-password / reset-password OTP flow."""

    def setUp(self):
        # forgot-password/reset-password share the 'auth' throttle scope with
        # every other view in this module — clear it so an earlier test class
        # (e.g. AuthThrottleTests deliberately exhausting the scope) can't
        # bleed a 429 into these tests when the whole suite runs together.
        cache.clear()

    def _make_user(self, **kwargs):
        defaults = dict(
            username="candidate",
            email="candidate@example.com",
            is_email_verified=True,
        )
        defaults.update(kwargs)
        user = User(**defaults)
        user.set_password("oldpass123")
        user.save()
        return user

    def test_forgot_password_does_not_leak_unknown_email(self):
        client = APIClient()
        resp = client.post(
            reverse("auth-forgot-password"),
            {"email": "nobody@example.com"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("detail", resp.data)

    def test_forgot_password_creates_otp_for_known_email(self):
        from .models import PasswordResetOTP

        user = self._make_user()
        client = APIClient()
        resp = client.post(
            reverse("auth-forgot-password"),
            {"email": user.email},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            PasswordResetOTP.objects.filter(user=user, is_used=False).exists()
        )

    def test_reset_password_with_correct_code_succeeds_and_issues_tokens(self):
        from .models import PasswordResetOTP

        user = self._make_user()
        otp = PasswordResetOTP.generate_for_user(user)

        client = APIClient()
        resp = client.post(
            reverse("auth-reset-password"),
            {
                "email": user.email,
                "code": otp.code,
                "new_password": "newpass456",
                "new_password2": "newpass456",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

        user.refresh_from_db()
        self.assertTrue(user.check_password("newpass456"))

        # Old password no longer works, new one does, via the real login view.
        login_resp = client.post(
            reverse("auth-login"),
            {"email": user.email, "password": "newpass456"},
            format="json",
        )
        self.assertEqual(login_resp.status_code, 200)

    def test_reset_password_with_wrong_code_fails_and_increments_attempts(self):
        from .models import PasswordResetOTP

        user = self._make_user()
        otp = PasswordResetOTP.generate_for_user(user)

        client = APIClient()
        resp = client.post(
            reverse("auth-reset-password"),
            {
                "email": user.email,
                "code": "000000" if otp.code != "000000" else "111111",
                "new_password": "newpass456",
                "new_password2": "newpass456",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        otp.refresh_from_db()
        self.assertEqual(otp.attempts, 1)
        user.refresh_from_db()
        self.assertTrue(user.check_password("oldpass123"))

    def test_reset_password_with_expired_code_fails(self):
        from .models import PasswordResetOTP

        user = self._make_user()
        otp = PasswordResetOTP.generate_for_user(user)
        otp.created_at = timezone.now() - timedelta(minutes=11)
        otp.save(update_fields=["created_at"])

        client = APIClient()
        resp = client.post(
            reverse("auth-reset-password"),
            {
                "email": user.email,
                "code": otp.code,
                "new_password": "newpass456",
                "new_password2": "newpass456",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 400)

    def test_reset_password_mismatched_confirmation_rejected(self):
        from .models import PasswordResetOTP

        user = self._make_user()
        otp = PasswordResetOTP.generate_for_user(user)

        client = APIClient()
        resp = client.post(
            reverse("auth-reset-password"),
            {
                "email": user.email,
                "code": otp.code,
                "new_password": "newpass456",
                "new_password2": "different789",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        user.refresh_from_db()
        self.assertTrue(user.check_password("oldpass123"))


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
