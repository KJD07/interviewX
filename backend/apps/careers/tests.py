from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.companies.models import Company, InterviewQuestion, Role, Round

from . import feeds
from .ats import ats_check
from .models import Job, JobFeedState, ResumeCheck
from .practice import score_answer

User = get_user_model()
RESUME = "Software engineer with 4 years building web apps using React, Python and Django. " * 3


def make_job(**kw):
    defaults = dict(source="t", external_id=str(Job.objects.count()), title="Python Developer",
                    company="Acme", url="https://x.test/1", posted_at=timezone.now(),
                    description="We need Python, Django, PostgreSQL, Docker and AWS experience.")
    defaults.update(kw)
    return Job.objects.create(**defaults)


class SkillGraphATSTests(TestCase):
    def test_alias_and_implication(self):
        r = ats_check("I know k8s and reactjs", "Frontend", "Need Docker, JavaScript and React")
        self.assertIn("javascript", r["matched_keywords"])  # implied by React
        self.assertIn("docker", r["matched_keywords"])      # implied by Kubernetes alias
        self.assertEqual(r["ats_score"], 100)

    def test_missing_keywords_and_score(self):
        r = ats_check(RESUME, "Python Developer", "Python Django PostgreSQL Docker AWS")
        self.assertEqual(set(r["missing_keywords"]), {"docker", "aws", "postgresql"})
        self.assertLess(r["ats_score"], 100)

    def test_no_recognisable_skills(self):
        self.assertIsNone(ats_check(RESUME, "Role", "Be nice")["ats_score"])

    def test_word_boundaries(self):
        r = ats_check("javascript developer", "x", "Need Java")
        self.assertEqual(r["matched_keywords"], [])


class PracticeScoringTests(TestCase):
    IDEAL = "Use a hash map to store seen values and look up the complement in constant time"

    def test_blank_is_zero(self):
        self.assertEqual(score_answer("", self.IDEAL)["score"], 0)

    def test_good_answer_scores_high(self):
        ans = ("I would iterate once and store each seen value in a hash map, then look up the "
               "complement of the current number; the lookup is constant time so overall it is linear.")
        self.assertGreaterEqual(score_answer(ans, self.IDEAL)["score"], 8)

    def test_short_answer_capped(self):
        self.assertLessEqual(score_answer("hash map seen values complement constant time lookup", self.IDEAL)["score"], 4)


class FeedRefreshTests(TestCase):
    def test_lazy_refresh_every_five_hours(self):
        row = dict(source="remotive", external_id="1", title="T", company="C", location="", url="https://a.test",
                   description="", tags=[], posted_at=timezone.now())
        with mock.patch.object(feeds, "FETCHERS", (lambda: [dict(row)],)):
            self.assertTrue(feeds.refresh_if_stale())
            self.assertFalse(feeds.refresh_if_stale())  # fresh -> no refetch
            JobFeedState.objects.update(last_refreshed_at=timezone.now() - timedelta(hours=5, minutes=1))
            self.assertTrue(feeds.refresh_if_stale())
        self.assertEqual(Job.objects.count(), 1)  # upsert, not duplicate

    def test_failing_feed_does_not_raise(self):
        def boom():
            raise RuntimeError("down")
        with mock.patch.object(feeds, "FETCHERS", (boom,)):
            self.assertTrue(feeds.refresh_if_stale())
        self.assertIn("boom", JobFeedState.objects.get().last_error)


@override_settings(PLATFORM_FREE=True, PLATFORM_FREE_MONTHLY_LIMIT=5)
class CareersAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u", email="u@ex.com", password="pw12345!")
        self.c = APIClient()
        self.c.force_authenticate(self.user)
        self.job = make_job()
        JobFeedState.objects.create(pk=1, last_refreshed_at=timezone.now())  # skip network

    def test_requires_auth(self):
        self.assertEqual(APIClient().get("/api/careers/jobs/").status_code, 401)

    def test_job_list_and_search(self):
        make_job(title="Chef", description="cook", company="Diner")
        r = self.c.get("/api/careers/jobs/?q=python")
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(r.data["ats_quota"], {"limit": 15, "used": 0})

    def test_resume_check_and_daily_cap(self):
        url = f"/api/careers/jobs/{self.job.id}/resume-check/"
        r = self.c.post(url, {"resume_text": RESUME}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("docker", r.data["missing_keywords"])
        for _ in range(14):
            self.assertEqual(self.c.post(url, {"resume_text": RESUME}, format="json").status_code, 200)
        r = self.c.post(url, {"resume_text": RESUME}, format="json")
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.data["code"], "ats_daily_limit")

    def test_paid_plan_unlimited(self):
        self.user.subscription_plan = "pro"
        self.user.save()
        for i in range(16):
            ResumeCheck.objects.create(user=self.user, job=self.job, ats_score=50)
        r = self.c.post(f"/api/careers/jobs/{self.job.id}/resume-check/", {"resume_text": RESUME}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data["ats_quota"]["limit"])

    def test_short_resume_rejected_without_consuming_quota(self):
        r = self.c.post(f"/api/careers/jobs/{self.job.id}/resume-check/", {"resume_text": "hi"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(ResumeCheck.objects.count(), 0)

    def test_practice_flow_hides_ideal_answer_until_validated(self):
        co = Company.objects.create(name="Acme", is_free=False)
        rnd = Round.objects.create(role=Role.objects.create(company=co, title="SDE"), title="Tech")
        q = InterviewQuestion.objects.create(round=rnd, question_text="Two sum?", question_type="coding",
                                             ideal_answer=PracticeScoringTests.IDEAL)
        lst = self.c.get("/api/careers/practice/questions/")  # accessible: platform is free
        self.assertEqual([x["id"] for x in lst.data], [q.id])
        self.assertNotIn("ideal_answer", lst.data[0])
        r = self.c.post("/api/careers/practice/validate/", {"question_id": q.id, "answer": "hash map"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("score", r.data)

    @override_settings(PLATFORM_FREE=False)
    def test_practice_respects_plan_when_not_free(self):
        co = Company.objects.create(name="Acme", is_free=False)
        rnd = Round.objects.create(role=Role.objects.create(company=co, title="SDE"), title="Tech")
        InterviewQuestion.objects.create(round=rnd, question_text="Q", question_type="coding", ideal_answer="alpha beta")
        self.assertEqual(self.c.get("/api/careers/practice/questions/").data, [])


@override_settings(PLATFORM_FREE=True, PLATFORM_FREE_MONTHLY_LIMIT=5)
class PlatformFreeTests(TestCase):
    def test_free_user_gets_max_features_but_capped_interviews(self):
        from apps.subscriptions.plans import effective_monthly_limit, effective_plan
        u = User.objects.create_user(username="f", email="f@ex.com", password="pw12345!")
        self.assertEqual(effective_plan(u), "max")
        self.assertEqual(effective_monthly_limit(u), 5)
