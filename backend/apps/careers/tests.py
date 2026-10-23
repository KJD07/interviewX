from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.companies.models import Company, InterviewQuestion, Role, Round

from . import feeds
from .ats import ats_check
from .models import CandidateProfile, Job, JobApplication, JobBoard, JobFeedState, ResumeCheck, SavedJob
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


@override_settings(JOB_REFRESH_SYNC=True)
@mock.patch.object(feeds, "refresh_boards", lambda: (0, 0))
class FeedRefreshTests(TestCase):
    def test_lazy_refresh_every_five_hours(self):
        row = feeds._row(source="remotive", external_id="1", title="T", company="C", location="", url="https://a.test",
                         description="", tags=[], posted_at=timezone.now())
        with mock.patch.object(feeds, "FETCHERS", (lambda: [dict(row)],)):
            self.assertTrue(feeds.refresh_if_stale())
            self.assertFalse(feeds.refresh_if_stale())  # fresh -> no refetch
            JobFeedState.objects.update(last_refreshed_at=timezone.now() - timedelta(hours=5, minutes=1))
            self.assertTrue(feeds.refresh_if_stale())
        self.assertEqual(Job.objects.count(), 1)  # upsert, not duplicate
        self.assertFalse(feeds.is_sweeping(JobFeedState.objects.get()))

    def test_failing_feed_does_not_raise(self):
        def boom():
            raise RuntimeError("down")
        with mock.patch.object(feeds, "FETCHERS", (boom,)):
            self.assertTrue(feeds.refresh_if_stale())
        self.assertIn("boom", JobFeedState.objects.get().last_error)

    def test_background_sweep_when_not_sync(self):
        with override_settings(JOB_REFRESH_SYNC=False), mock.patch.object(feeds.threading, "Thread") as thread:
            self.assertTrue(feeds.refresh_if_stale())
        thread.assert_called_once()
        thread.return_value.start.assert_called_once()
        self.assertTrue(feeds.is_sweeping(JobFeedState.objects.get()))


    def test_external_sweeper_requests_only_cover_when_twice_stale(self):
        JobFeedState.objects.create(pk=1, last_refreshed_at=timezone.now() - timedelta(hours=6),
                                    last_finished_at=timezone.now() - timedelta(hours=6))
        with override_settings(JOB_SWEEPER_EXTERNAL=True), mock.patch.object(feeds, "FETCHERS", ()):
            self.assertFalse(feeds.refresh_if_stale())  # the sweeper's job, not the request's
            JobFeedState.objects.update(last_refreshed_at=timezone.now() - timedelta(hours=11))
            self.assertTrue(feeds.refresh_if_stale())

    def test_sweep_that_died_midway_is_reclaimed(self):
        JobFeedState.objects.create(pk=1, last_refreshed_at=timezone.now() - timedelta(hours=2),
                                    last_finished_at=timezone.now() - timedelta(hours=7))
        self.assertTrue(feeds.claim_sweep(timedelta(hours=5)))
        self.assertFalse(feeds.claim_sweep(timedelta(hours=5)))  # just claimed, still running

    def test_sweep_jobs_command_once(self):
        from django.core.management import call_command
        with mock.patch.object(feeds, "FETCHERS", ()):
            call_command("sweep_jobs", "--once", stdout=mock.Mock())
            state = JobFeedState.objects.get()
            self.assertFalse(feeds.is_sweeping(state))
            call_command("sweep_jobs", "--once", stdout=mock.Mock())  # fresh -> no second sweep
        self.assertEqual(JobFeedState.objects.get().last_refreshed_at, state.last_refreshed_at)

    def test_resweep_skips_unchanged_rows(self):
        row = feeds._row(source="remotive", external_id="1", title="T", company="C", location="", url="https://a.test",
                         description="Python", tags=[], posted_at=timezone.now())
        feeds._upsert([dict(row)])
        with mock.patch.object(Job.objects, "bulk_create") as bulk:
            feeds._upsert([dict(row)])
        bulk.assert_not_called()
        feeds._upsert([dict(row, description="Python and Go")])
        self.assertEqual(Job.objects.get().description, "Python and Go")
        self.assertEqual(Job.objects.count(), 1)


def _resp(payload):
    r = mock.Mock()
    r.json.return_value = payload
    r.raise_for_status.return_value = r
    return r


class DescriptionCleaningTests(TestCase):
    def test_html_keeps_paragraphs_and_bullets(self):
        raw = "<h3>About us</h3><p>We build &amp; ship.</p><ul><li><p>Python</p></li><li>Docker</li></ul>"
        self.assertEqual(feeds._clean_description(raw), "About us\nWe build & ship.\n- Python\n- Docker")

    def test_plain_text_newlines_survive(self):
        raw = feeds._html_lines("Line one\n\nUse <Go>\n- x")
        self.assertEqual(feeds._clean_description(raw), "Line one\nUse <Go>\n- x")


class CompanyBoardTests(TestCase):
    """Greenhouse / Lever / Ashby boards: parsing, closed-role removal, auto-deactivation."""

    GH = {"jobs": [
        {"id": 1, "title": "Senior Backend Engineer", "absolute_url": "https://gh.test/1",
         "location": {"name": "Bengaluru, India"}, "first_published": "2026-10-20T10:00:00Z", "company_name": "Acme"},
        {"id": 2, "title": "Software Engineering Intern", "absolute_url": "https://gh.test/2",
         "location": {"name": "Remote - India"}, "updated_at": "2026-10-21T10:00:00Z"},
    ]}
    LEVER = [{"id": "abc", "text": "Data Analyst", "hostedUrl": "https://lever.test/abc", "createdAt": 1792000000000,
              "workplaceType": "hybrid", "categories": {"location": "Pune", "team": "Data", "commitment": "Full-time"},
              "descriptionPlain": "Need SQL, Python and Tableau. 2+ years of experience.", "lists": []}]
    ASHBY = {"jobs": [{"id": "z1", "title": "Frontend Engineer", "jobUrl": "https://ashby.test/z1", "isListed": True,
                       "location": "Remote", "isRemote": True, "workplaceType": "Remote",
                       "publishedAt": "2026-10-19T00:00:00Z", "descriptionPlain": "React and TypeScript."}]}

    def setUp(self):
        self.gh = JobBoard.objects.create(ats="greenhouse", token="acme", company="Acme")
        self.lv = JobBoard.objects.create(ats="lever", token="beta", company="Beta")
        self.ab = JobBoard.objects.create(ats="ashby", token="gamma", company="Gamma")

    def _client(self, gh=None):
        client = mock.Mock()
        payloads = {"greenhouse": gh or self.GH, "lever": self.LEVER, "ashby": self.ASHBY}
        client.get.side_effect = lambda url, **kw: _resp(next(v for k, v in (
            ("boards-api.greenhouse.io", payloads["greenhouse"]), ("api.lever.co", payloads["lever"]),
            ("api.ashbyhq.com", payloads["ashby"])) if k in url))
        return client

    def _sweep(self, client):
        with mock.patch.object(feeds.httpx, "Client") as cls:
            cls.return_value.__enter__.return_value = client
            return feeds.refresh_boards(list(JobBoard.objects.filter(is_active=True)))

    def test_parses_all_three_ats(self):
        self.assertEqual(self._sweep(self._client()), (3, 0))
        senior = Job.objects.get(external_id="acme:1")
        self.assertEqual((senior.level, senior.work_mode, senior.board, senior.company),
                         ("senior", "onsite", self.gh, "Acme"))
        intern = Job.objects.get(external_id="acme:2")
        self.assertEqual((intern.level, intern.work_mode), ("entry", "remote"))
        analyst = Job.objects.get(source="lever")
        self.assertEqual((analyst.work_mode, analyst.level), ("hybrid", "mid"))
        self.assertIn("tableau", analyst.skills)
        fe = Job.objects.get(source="ashby")
        self.assertEqual(fe.work_mode, "remote")
        self.assertIn("react", fe.skills)

    def test_closed_roles_removed_but_tracking_kept(self):
        self._sweep(self._client())
        user = User.objects.create_user(username="s", email="s@ex.com", password="pw12345!")
        job = Job.objects.get(external_id="acme:2")
        SavedJob.objects.create(user=user, job=job, **SavedJob.snapshot_of(job))
        self._sweep(self._client(gh={"jobs": self.GH["jobs"][:1]}))  # company closed job 2
        self.assertFalse(Job.objects.filter(external_id="acme:2").exists())
        saved = SavedJob.objects.get()
        self.assertIsNone(saved.job)
        self.assertEqual(saved.title, "Software Engineering Intern")

    def test_failing_board_deactivates_after_repeated_failures(self):
        client = self._client()
        client.get.side_effect = RuntimeError("404")
        for _ in range(feeds.DEACTIVATE_AFTER):
            self._sweep(client)
        self.assertFalse(JobBoard.objects.filter(is_active=True).exists())

    def test_greenhouse_description_fetched_lazily(self):
        self._sweep(self._client())
        job = Job.objects.get(external_id="acme:1")
        self.assertEqual(job.description, "")
        with mock.patch.object(feeds.httpx, "get", return_value=_resp(
                {"content": "&lt;p&gt;Go, Kubernetes and PostgreSQL. 6+ years.&lt;/p&gt;"})):
            feeds.ensure_description(job)
        job.refresh_from_db()
        self.assertIn("Kubernetes", job.description)
        self.assertIn("kubernetes", job.skills)
        self._sweep(self._client())  # re-sweep must not wipe the fetched description
        job.refresh_from_db()
        self.assertIn("kubernetes", job.skills)

    def test_boards_file_seeds_once(self):
        self.assertGreaterEqual(feeds.sync_boards_from_file(), 900)
        self.assertEqual(feeds.sync_boards_from_file(), 0)


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


PROFILE_RESUME = """Priya Sharma
priya.sharma@example.com | +91 98765 43210 | linkedin.com/in/priyasharma | github.com/priyas
Summary
Backend engineer with 3 years of experience building APIs in Python and Django.
Experience
Software Engineer
Acme Corp
Jan 2023 - Present
- Built REST APIs with Django and PostgreSQL, deployed on AWS with Docker.
Education
B.Tech Computer Science
IIT Delhi
2018 - 2022
Skills
Python, Django, PostgreSQL, Docker, React
"""


class CandidateProfileTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="p", email="p@ex.com", password="pw12345!")
        self.c = APIClient()
        self.c.force_authenticate(self.user)
        JobFeedState.objects.create(pk=1, last_refreshed_at=timezone.now())

    def _upload(self, text=PROFILE_RESUME, name="cv.txt"):
        from django.core.files.uploadedfile import SimpleUploadedFile
        with mock.patch.dict("os.environ", {"OPENROUTER_API_KEY": ""}):
            return self.c.post("/api/careers/profile/resume/",
                               {"resume_file": SimpleUploadedFile(name, text.encode())}, format="multipart")

    def test_upload_fills_profile_with_rules(self):
        r = self._upload()
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["full_name"], "Priya Sharma")
        self.assertEqual(r.data["email"], "priya.sharma@example.com")
        self.assertEqual(r.data["phone"], "+91 98765 43210")
        self.assertIn("linkedin.com/in/priyasharma", r.data["linkedin_url"])
        self.assertEqual(float(r.data["total_experience_years"]), 3.0)
        self.assertTrue({"python", "django", "postgresql", "docker"} <= set(r.data["skills"]))
        exp = r.data["experience"][0]
        self.assertEqual((exp["title"], exp["company"], exp["end"]), ("Software Engineer", "Acme Corp", "Present"))
        self.assertEqual(r.data["education"][0]["institution"], "IIT Delhi")
        self.assertTrue(r.data["has_resume"])
        self.assertEqual(r.data["resume_parsed_by"], "rules")
        dl = self.c.get("/api/careers/profile/resume/")
        self.assertEqual(dl.status_code, 200)
        self.assertIn(b"Priya", b"".join(dl.streaming_content))

    def test_llm_parse_used_when_available(self):
        reply = '```json\n{"full_name": "P S", "skills": ["Go"], "experience": [{"title": "SWE", "company": "X"}], ' \
                '"total_experience_years": 2, "email": "bad-email"}\n```'
        with mock.patch.dict("os.environ", {"OPENROUTER_API_KEY": "k"}), \
                mock.patch("apps.careers.profile_parser.chat_completion", return_value=reply):
            from django.core.files.uploadedfile import SimpleUploadedFile
            r = self.c.post("/api/careers/profile/resume/",
                            {"resume_file": SimpleUploadedFile("cv.txt", PROFILE_RESUME.encode())}, format="multipart")
        self.assertEqual(r.data["resume_parsed_by"], "ai")
        self.assertEqual(r.data["full_name"], "P S")
        self.assertEqual(r.data["skills"][0], "Go")
        self.assertIn("django", r.data["skills"])  # keyword graph tops up the model's list
        self.assertEqual(r.data["email"], "p@ex.com")  # invalid parsed email -> account email

    def test_manual_edit_and_validation(self):
        r = self.c.patch("/api/careers/profile/", {
            "headline": "Backend Engineer", "skills": ["Python", "python", " Go "],
            "experience": [{"title": "SWE", "company": "X", "bogus": "dropped"}],
            "work_modes": ["remote"], "target_roles": ["Backend Engineer"],
        }, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["skills"], ["Python", "Go"])
        self.assertNotIn("bogus", r.data["experience"][0])
        bad = self.c.patch("/api/careers/profile/", {"work_modes": ["moon"]}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_bad_resume_rejected(self):
        self.assertEqual(self._upload("too short").status_code, 400)
        self.assertFalse(CandidateProfile.objects.filter(resume_text__gt="").exists())

    def test_ats_check_uses_profile_resume(self):
        self._upload()
        job = make_job()
        r = self.c.post(f"/api/careers/jobs/{job.id}/resume-check/", {}, format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn("aws", r.data["matched_keywords"])


class SavedAndApplicationsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="a", email="a@ex.com", password="pw12345!")
        self.c = APIClient()
        self.c.force_authenticate(self.user)
        self.job = make_job()
        JobFeedState.objects.create(pk=1, last_refreshed_at=timezone.now())

    def test_save_and_unsave(self):
        self.assertEqual(self.c.post(f"/api/careers/jobs/{self.job.id}/save/").status_code, 200)
        self.c.post(f"/api/careers/jobs/{self.job.id}/save/")  # idempotent
        saved = self.c.get("/api/careers/saved/").data
        self.assertEqual(len(saved), 1)
        self.assertTrue(saved[0]["is_live"])
        self.assertTrue(self.c.get("/api/careers/jobs/").data["results"][0]["saved"])
        self.c.delete(f"/api/careers/jobs/{self.job.id}/save/")
        self.assertEqual(self.c.get("/api/careers/saved/").data, [])

    def test_apply_tracker(self):
        r = self.c.post("/api/careers/applications/", {"job_id": self.job.id}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.c.post("/api/careers/applications/", {"job_id": self.job.id}, format="json").status_code, 200)
        self.assertEqual(self.c.get("/api/careers/jobs/").data["results"][0]["application_status"], "applied")
        r = self.c.patch(f"/api/careers/applications/{r.data['id']}/", {"status": "interviewing", "notes": "R1 Fri"},
                         format="json")
        self.assertEqual((r.data["status"], r.data["notes"]), ("interviewing", "R1 Fri"))
        manual = self.c.post("/api/careers/applications/", {"title": "SDE", "company": "Elsewhere"}, format="json")
        self.assertEqual(manual.status_code, 201)
        self.assertFalse(manual.data["is_live"])
        self.assertEqual(len(self.c.get("/api/careers/applications/").data), 2)

    def test_other_users_rows_hidden(self):
        app = JobApplication.objects.create(user=User.objects.create_user(username="o", email="o@ex.com"),
                                            title="X", company="Y")
        self.assertEqual(self.c.patch(f"/api/careers/applications/{app.id}/", {"status": "offer"},
                                      format="json").status_code, 404)
        self.assertEqual(self.c.get("/api/careers/applications/").data, [])


class JobFilterAndMatchTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="m", email="m@ex.com", password="pw12345!")
        self.c = APIClient()
        self.c.force_authenticate(self.user)
        JobFeedState.objects.create(pk=1, last_refreshed_at=timezone.now())
        now = timezone.now()
        self.backend = make_job(title="Backend Engineer", skills=["python", "django", "postgresql"],
                                level="mid", work_mode="remote", posted_at=now - timedelta(days=5))
        self.chef = make_job(title="Head Chef", skills=[], level="senior", work_mode="onsite", posted_at=now)
        self.fe = make_job(title="Frontend Engineer", skills=["react", "css"], level="entry", work_mode="hybrid",
                           location="Bengaluru", posted_at=now - timedelta(hours=2))

    def _ids(self, qs):
        return [j["id"] for j in self.c.get("/api/careers/jobs/" + qs).data["results"]]

    def test_filters(self):
        self.assertEqual(self._ids("?work_mode=remote"), [self.backend.id])
        self.assertEqual(self._ids("?level=entry,senior"), [self.chef.id, self.fe.id])
        self.assertEqual(self._ids("?posted=1"), [self.chef.id, self.fe.id])
        self.assertEqual(self._ids("?location=bengaluru"), [self.fe.id])
        self.assertEqual(self._ids("?q=django"), [self.backend.id])

    def test_best_match_ranks_by_profile(self):
        r = self.c.get("/api/careers/jobs/?sort=match")
        self.assertEqual(r.data["sort"], "recent")  # no profile yet -> falls back
        self.assertFalse(r.data["has_profile"])
        CandidateProfile.objects.create(user=self.user, skills=["Python", "Django"], target_roles=["Backend Engineer"],
                                        experience_level="mid")
        r = self.c.get("/api/careers/jobs/?sort=match")
        self.assertEqual(r.data["sort"], "match")
        self.assertEqual(r.data["results"][0]["id"], self.backend.id)
        self.assertGreater(r.data["results"][0]["match"], 70)
        self.assertNotIn(self.chef.id, [j["id"] for j in r.data["results"]])  # nothing in common
