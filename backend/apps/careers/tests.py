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


@override_settings(PLATFORM_FREE=True)
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


@override_settings(PLATFORM_FREE=True)
class PlatformFreeTests(TestCase):
    def test_everyone_gets_max(self):
        from apps.subscriptions.plans import effective_monthly_limit, effective_plan
        for plan in ("free", "pro"):
            u = User.objects.create_user(username=plan, email=f"{plan}@ex.com", password="pw12345!",
                                         subscription_plan=plan)
            self.assertEqual(effective_plan(u), "max")
            self.assertEqual(effective_monthly_limit(u), 50)


class ResumeUploadTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="r", email="r@ex.com", password="pw12345!")
        self.c = APIClient()
        self.c.force_authenticate(self.user)
        self.job = make_job()
        self.url = f"/api/careers/jobs/{self.job.id}/resume-check/"

    def _post(self, name, data):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return self.c.post(self.url, {"resume_file": SimpleUploadedFile(name, data)}, format="multipart")

    def test_txt_upload(self):
        r = self._post("cv.txt", RESUME.encode())
        self.assertEqual(r.status_code, 200)
        self.assertIn("docker", r.data["missing_keywords"])

    def test_docx_upload(self):
        import io, docx
        d = docx.Document()
        d.add_paragraph(RESUME)
        buf = io.BytesIO()
        d.save(buf)
        r = self._post("cv.docx", buf.getvalue())
        self.assertEqual(r.status_code, 200)
        self.assertIn("python", r.data["matched_keywords"])

    def test_pdf_upload(self):
        from pypdf import PdfWriter
        import io
        w = PdfWriter()
        w.add_blank_page(200, 200)
        buf = io.BytesIO()
        w.write(buf)
        r = self._post("cv.pdf", buf.getvalue())  # blank page -> no text
        self.assertEqual(r.status_code, 400)
        self.assertIn("No readable text", r.data["detail"])

    def test_bad_files_rejected_without_quota(self):
        self.assertEqual(self._post("cv.doc", b"x" * 500).status_code, 400)
        self.assertEqual(self._post("cv.exe", b"MZ" + b"x" * 500).status_code, 400)
        self.assertEqual(self._post("cv.pdf", b"not a pdf at all").status_code, 400)
        self.assertEqual(ResumeCheck.objects.count(), 0)


def _jev_response(fit_score, nouls):
    answers = {"fit": {"type": "score", "score": fit_score}}
    answers.update({f"s{i}": {"type": "noul", "noul": p} for i, p in enumerate(nouls)})
    resp = mock.Mock()
    resp.json.return_value = {"answers": answers}
    resp.raise_for_status.return_value = None
    return resp


class JevTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="j", email="j@ex.com", password="pw12345!")
        self.c = APIClient()
        self.c.force_authenticate(self.user)
        self.job = make_job()  # needs python django postgresql docker aws
        self.url = f"/api/careers/jobs/{self.job.id}/resume-check/"

    @override_settings(TYPESAFE_API_KEY="")
    def test_disabled_without_key_makes_no_call(self):
        with mock.patch("apps.careers.jev.httpx.post") as post:
            r = self.c.post(self.url, {"resume_text": RESUME}, format="json")
        post.assert_not_called()
        self.assertFalse(r.data["ai_assisted"])
        self.assertNotIn("ai_fit", r.data)

    @override_settings(TYPESAFE_API_KEY="k")
    def test_jev_confirms_missing_skill_and_adds_fit(self):
        with override_settings(TYPESAFE_API_KEY=""):
            baseline = self.c.post(self.url, {"resume_text": RESUME}, format="json").data
        missing = baseline["missing_keywords"]  # order matches the Noul questions Jev is asked
        nouls = [0.95 if m == "docker" else 0.1 for m in missing]
        with mock.patch("apps.careers.jev.httpx.post", return_value=_jev_response(3.0, nouls)) as post:
            r = self.c.post(self.url, {"resume_text": RESUME}, format="json")
        self.assertTrue(r.data["ai_assisted"])
        self.assertEqual(r.data["ai_fit"], 75)
        self.assertIn("docker", r.data["matched_keywords"])
        self.assertNotIn("docker", r.data["missing_keywords"])
        self.assertGreater(r.data["ats_score"], baseline["ats_score"])
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "Bearer k")

    @override_settings(TYPESAFE_API_KEY="k")
    def test_jev_failure_falls_back_to_keyword_result(self):
        with mock.patch("apps.careers.jev.httpx.post", side_effect=RuntimeError("boom")):
            r = self.c.post(self.url, {"resume_text": RESUME}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["ai_assisted"])
        self.assertIn("docker", r.data["missing_keywords"])

    @override_settings(TYPESAFE_API_KEY="k")
    def test_over_quota_user_never_triggers_jev(self):
        for _ in range(15):
            ResumeCheck.objects.create(user=self.user, job=self.job, ats_score=1)
        with mock.patch("apps.careers.jev.httpx.post") as post:
            r = self.c.post(self.url, {"resume_text": RESUME}, format="json")
        self.assertEqual(r.status_code, 429)
        post.assert_not_called()


class ATSGraphPathTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="g", email="g@ex.com", password="pw12345!")
        self.job = make_job()

    def _run(self, **kw):
        from core.graph import path
        from .graphs import run_ats_check
        kw.setdefault("resume_text", RESUME)
        code, body, trace = run_ats_check(self.user, kw.pop("job_id", self.job.id), **kw)
        return code, body, path(trace)

    @override_settings(TYPESAFE_API_KEY="")
    def test_jev_off_skips_jev_node(self):
        code, _, p = self._run()
        self.assertEqual((code, p), (200, ["parse_resume", "load_job", "keyword_score", "quota_precheck", "save"]))

    @override_settings(TYPESAFE_API_KEY="k")
    def test_jev_on_rescores(self):
        with mock.patch("apps.careers.jev.httpx.post", return_value=_jev_response(4.0, [0.9] * 10)):
            code, body, p = self._run()
        self.assertEqual(p[-3:], ["jev_assess", "rescore", "save"])
        self.assertEqual(body["missing_keywords"], [])

    @override_settings(TYPESAFE_API_KEY="k")
    def test_jev_failure_goes_straight_to_save(self):
        with mock.patch("apps.careers.jev.httpx.post", side_effect=RuntimeError):
            code, body, p = self._run()
        self.assertEqual(p[-2:], ["jev_assess", "save"])
        self.assertFalse(body["ai_assisted"])

    def test_early_exits(self):
        self.assertEqual(self._run(resume_text="short")[::2], (400, ["parse_resume"]))
        self.assertEqual(self._run(job_id=99999)[0], 404)
        nothing = make_job(title="Role", description="Be nice")
        self.assertEqual(self._run(job_id=nothing.id)[0], 422)

    @override_settings(TYPESAFE_API_KEY="k")
    def test_over_quota_ends_before_jev(self):
        for _ in range(15):
            ResumeCheck.objects.create(user=self.user, job=self.job, ats_score=1)
        with mock.patch("apps.careers.jev.httpx.post") as post:
            code, body, p = self._run()
        self.assertEqual((code, p[-1]), (429, "quota_precheck"))
        self.assertIn("ATS Unlimited", body["detail"])
        post.assert_not_called()


def _grade_response(score):
    resp = mock.Mock()
    resp.json.return_value = {"answers": {"grade": {"type": "score", "score": score}}}
    resp.raise_for_status.return_value = None
    return resp


class PracticeGraphTests(TestCase):
    Q = "Two sum?"
    IDEAL = PracticeScoringTests.IDEAL
    # ~half the ideal terms and >25 words -> keyword score in the uncertain 3..8 band
    MID = ("I would loop over the numbers and keep a hash map of what I have already visited, "
           "checking each time whether the needed partner number is already stored there before adding it.")

    def _run(self, answer):
        from core.graph import path
        from .graphs import run_practice
        result, trace = run_practice(self.Q, self.IDEAL, answer)
        return result, path(trace)

    def test_mid_answer_is_uncertain(self):
        s = score_answer(self.MID, self.IDEAL)["score"]
        self.assertTrue(3 <= s < 8, s)

    @override_settings(TYPESAFE_API_KEY="k")
    def test_confident_answers_make_no_jev_call(self):
        good = ("I would iterate once and store each seen value in a hash map, then look up the "
                "complement of the current number; the lookup is constant time so overall it is linear.")
        with mock.patch("apps.careers.jev.httpx.post") as post:
            for ans in ("", "no idea", good):
                result, p = self._run(ans)
                self.assertEqual(p, ["keyword_score"])
                self.assertFalse(result["ai_assisted"])
        post.assert_not_called()

    @override_settings(TYPESAFE_API_KEY="")
    def test_jev_off_uses_keywords(self):
        result, p = self._run(self.MID)
        self.assertEqual((p, result["method"]), (["keyword_score"], "keyword"))

    @override_settings(TYPESAFE_API_KEY="k")
    def test_uncertain_answer_combined_and_clamped(self):
        kw = score_answer(self.MID, self.IDEAL)["score"]
        with mock.patch("apps.careers.jev.httpx.post", return_value=_grade_response(4.0)) as post:
            result, p = self._run(self.MID)
        self.assertEqual(p, ["keyword_score", "jev_grade", "combine"])
        self.assertTrue(result["ai_assisted"])
        self.assertEqual(result["method"], "keyword+jev")
        self.assertEqual(result["score"], round(min(0.4 * kw + 6, kw + 4, 10), 1))
        self.assertLessEqual(result["score"], kw + 4)
        self.assertIn("CANDIDATE ANSWER", post.call_args.kwargs["json"]["state"])
        with mock.patch("apps.careers.jev.httpx.post", return_value=_grade_response(0.0)):
            self.assertEqual(self._run(self.MID)[0]["score"], round(0.4 * kw, 1))

    @override_settings(TYPESAFE_API_KEY="k")
    def test_jev_failure_falls_back(self):
        kw = score_answer(self.MID, self.IDEAL)["score"]
        with mock.patch("apps.careers.jev.httpx.post", side_effect=RuntimeError):
            result, p = self._run(self.MID)
        self.assertEqual(p, ["keyword_score", "jev_grade"])
        self.assertEqual((result["score"], result["ai_assisted"]), (kw, False))
