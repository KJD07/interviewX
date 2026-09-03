from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.companies.models import Company, Role, Round
from apps.interviews.models import InterviewSession

from .models import Organization, OrganizationMember, OrgCandidateInvite

User = get_user_model()


class OrgDashboardActivityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="recruiter",
            email="recruiter@acme.test",
            password="pw12345!",
        )
        self.org = Organization.objects.create(
            name="Acme Hiring",
            contact_email="hiring@acme.test",
            candidate_quota=20,
            contract_ends=timezone.now() + timedelta(days=90),
        )
        OrganizationMember.objects.create(
            organization=self.org, user=self.user, role=OrganizationMember.Role.ADMIN
        )
        company = Company.objects.create(
            name="Acme Hiring",
            tone_style="formal_strict",
            kind=Company.Kind.ENTERPRISE,
            organization=self.org,
        )
        role = Role.objects.create(company=company, title="Software Engineer")
        self.round = Round.objects.create(role=role, title="Technical Screen")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _invite(self, email, **kwargs):
        defaults = dict(
            organization=self.org,
            round=self.round,
            candidate_email=email,
            expires_at=timezone.now() + timedelta(days=7),
        )
        defaults.update(kwargs)
        return OrgCandidateInvite.objects.create(**defaults)

    def test_invite_series_is_twelve_weeks_and_counts_this_week(self):
        self._invite("one@acme.test")
        self._invite("two@acme.test")
        old = self._invite("old@acme.test")
        OrgCandidateInvite.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(weeks=3)
        )

        res = self.client.get("/api/enterprise/dashboard/")
        self.assertEqual(res.status_code, 200)
        series = res.json()["invite_series"]
        self.assertEqual(len(series), 12)
        self.assertEqual(series[-1]["count"], 2)
        self.assertEqual(series[-4]["count"], 1)
        self.assertEqual(sum(point["count"] for point in series), 3)

    def test_recent_activity_covers_live_finished_and_expiring(self):
        live_invite = self._invite("devsharma@gmail.com")
        session = InterviewSession.objects.create(
            user=self.user,
            round=self.round,
            status=InterviewSession.Status.IN_PROGRESS,
        )
        live_invite.session = session
        live_invite.status = OrgCandidateInvite.Status.STARTED
        live_invite.save()

        done_invite = self._invite("priya.n@outlook.com")
        done = InterviewSession.objects.create(
            user=self.user,
            round=self.round,
            status=InterviewSession.Status.COMPLETED,
            scores={"overall": 6, "technical": 5},
            ended_at=timezone.now() - timedelta(hours=2),
        )
        InterviewSession.objects.filter(pk=done.pk).update(
            started_at=timezone.now() - timedelta(hours=3)
        )
        done_invite.session = done
        done_invite.status = OrgCandidateInvite.Status.COMPLETED
        done_invite.save()

        self._invite(
            "yatinangi@gmail.com",
            expires_at=timezone.now() + timedelta(days=3),
        )

        res = self.client.get("/api/enterprise/dashboard/")
        activity = res.json()["recent_activity"]
        texts = [row["text"] for row in activity]
        self.assertTrue(any("devsharma@gmail.com started Technical Screen" == t for t in texts))
        self.assertTrue(any(row["live"] for row in activity if "devsharma" in row["text"]))
        self.assertTrue(any("priya.n@outlook.com finished Technical Screen — 6/10" == t for t in texts))
        self.assertTrue(any("yatinangi@gmail.com invited to Technical Screen" == t for t in texts))

    def test_non_member_still_gets_404(self):
        outsider = User.objects.create_user(
            username="outsider", email="out@test.com", password="pw12345!"
        )
        client = APIClient()
        client.force_authenticate(outsider)
        res = client.get("/api/enterprise/dashboard/")
        self.assertEqual(res.status_code, 404)
        self.assertNotIn("invite_series", res.json())

    def test_invite_create_succeeds_when_email_times_out(self):
        expires = (timezone.now() + timedelta(days=7)).isoformat()
        with patch(
            "apps.enterprise.emails.send_mail",
            side_effect=TimeoutError("timed out"),
        ):
            res = self.client.post(
                "/api/enterprise/invites/",
                {
                    "round": self.round.pk,
                    "candidate_email": "candidate@local.test",
                    "expires_at": expires,
                },
                format="json",
            )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["candidate_email"], "candidate@local.test")
        self.assertTrue(
            OrgCandidateInvite.objects.filter(
                organization=self.org, candidate_email="candidate@local.test"
            ).exists()
        )
