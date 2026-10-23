from django.conf import settings
from django.db import models


class JobBoard(models.Model):
    """One company's public careers board on a keyless ATS API (Greenhouse,
    Lever, Ashby). Seeded from data/job_boards.json; manageable in admin.
    A board that keeps failing (e.g. the company left that ATS) deactivates itself."""

    class ATS(models.TextChoices):
        GREENHOUSE = "greenhouse"
        LEVER = "lever"
        ASHBY = "ashby"
        SMARTRECRUITERS = "smartrecruiters"  # fetched with country=in: India roles only

    ats = models.CharField(max_length=20, choices=ATS.choices)
    token = models.CharField(max_length=120)
    company = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    consecutive_failures = models.PositiveSmallIntegerField(default=0)
    last_fetched_at = models.DateTimeField(null=True, blank=True)
    last_job_count = models.PositiveIntegerField(default=0)
    last_error = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["company"]
        constraints = [models.UniqueConstraint(fields=["ats", "token"], name="uniq_jobboard_ats_token")]

    def __str__(self) -> str:
        return f"{self.company} ({self.ats})"


class Job(models.Model):
    """A live job, pulled from a company board (JobBoard) or a free aggregator feed."""

    class WorkMode(models.TextChoices):
        REMOTE = "remote"
        HYBRID = "hybrid"
        ONSITE = "onsite"

    class Level(models.TextChoices):
        ENTRY = "entry"    # intern / fresher / junior (0–1 yr)
        MID = "mid"        # 1–5 yrs
        SENIOR = "senior"  # 5+ yrs, lead, staff, manager

    source = models.CharField(max_length=30)
    external_id = models.CharField(max_length=160)
    board = models.ForeignKey(JobBoard, null=True, blank=True, on_delete=models.CASCADE, related_name="jobs")
    title = models.CharField(max_length=300)
    company = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True)
    url = models.URLField(max_length=600)
    description = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    # Canonical skills (careers/skillgraph) found in the posting — stored at
    # ingest so match scoring and skill filtering never re-parse descriptions.
    skills = models.JSONField(default=list, blank=True)
    work_mode = models.CharField(max_length=10, choices=WorkMode.choices, blank=True, db_index=True)
    level = models.CharField(max_length=10, choices=Level.choices, blank=True, db_index=True)
    # Located in India, or remote and open to India/APAC/anywhere (feeds.is_india_job).
    # The jobs page shows only these by default.
    in_india = models.BooleanField(default=False, db_index=True)
    posted_at = models.DateTimeField(db_index=True)
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-posted_at"]
        constraints = [
            models.UniqueConstraint(fields=["source", "external_id"], name="uniq_job_source_extid"),
        ]

    def __str__(self) -> str:
        return f"{self.title} @ {self.company}"


class JobFeedState(models.Model):
    """Singleton row (pk=1) tracking the last feed refresh, so the 5-hour
    refresh can be evaluated lazily on request (no cron worker exists)."""

    last_refreshed_at = models.DateTimeField(null=True, blank=True)  # sweep claimed/started
    last_finished_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=300, blank=True)
    boards_ok = models.PositiveIntegerField(default=0)
    boards_failed = models.PositiveIntegerField(default=0)
    jobs_count = models.PositiveIntegerField(default=0)
    companies_count = models.PositiveIntegerField(default=0)
    india_jobs_count = models.PositiveIntegerField(default=0)
    india_companies_count = models.PositiveIntegerField(default=0)


class ResumeCheck(models.Model):
    """One resume-vs-job ATS check. Rows double as the daily-quota ledger, so
    they outlive the job (closed postings are deleted on every sweep)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="resume_checks")
    job = models.ForeignKey(Job, null=True, on_delete=models.SET_NULL, related_name="resume_checks")
    ats_score = models.PositiveSmallIntegerField()
    matched_keywords = models.JSONField(default=list)
    missing_keywords = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


def resume_upload_to(instance, filename):
    return f"resumes/{instance.user_id}/{filename[-100:]}"


class CandidateProfile(models.Model):
    """Candidate portal profile. Filled once from an uploaded resume
    (careers/profile_parser.py), then freely edited by the candidate."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="candidate_profile")
    full_name = models.CharField(max_length=150, blank=True)
    headline = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    location = models.CharField(max_length=150, blank=True)
    summary = models.TextField(blank=True)
    linkedin_url = models.URLField(max_length=300, blank=True)
    github_url = models.URLField(max_length=300, blank=True)
    portfolio_url = models.URLField(max_length=300, blank=True)
    total_experience_years = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    skills = models.JSONField(default=list, blank=True)            # ["python", "react", ...]
    experience = models.JSONField(default=list, blank=True)        # [{title, company, location, start, end, description}]
    education = models.JSONField(default=list, blank=True)         # [{degree, institution, start, end, grade}]
    projects = models.JSONField(default=list, blank=True)          # [{name, description, link}]
    certifications = models.JSONField(default=list, blank=True)    # ["AWS SAA", ...]

    # Job preferences — drive "best match" ranking on Live jobs.
    target_roles = models.JSONField(default=list, blank=True)
    preferred_locations = models.JSONField(default=list, blank=True)
    work_modes = models.JSONField(default=list, blank=True)        # subset of Job.WorkMode
    experience_level = models.CharField(max_length=10, choices=Job.Level.choices, blank=True)

    resume_file = models.FileField(upload_to=resume_upload_to, blank=True)
    resume_filename = models.CharField(max_length=200, blank=True)
    resume_text = models.TextField(blank=True)
    resume_uploaded_at = models.DateTimeField(null=True, blank=True)
    resume_parsed_by = models.CharField(max_length=10, blank=True)  # "ai" | "rules"
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Profile of {self.user}"


class JobSnapshot(models.Model):
    """Saved/applied rows keep a copy of the posting: the Job row itself is
    deleted once the company closes the role."""

    title = models.CharField(max_length=300)
    company = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True)
    url = models.URLField(max_length=600, blank=True)

    class Meta:
        abstract = True

    @staticmethod
    def snapshot_of(job: Job) -> dict:
        return {"title": job.title, "company": job.company, "location": job.location, "url": job.url}


class SavedJob(JobSnapshot):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_jobs")
    job = models.ForeignKey(Job, null=True, on_delete=models.SET_NULL, related_name="saves")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "job"], name="uniq_savedjob_user_job")]


class JobApplication(JobSnapshot):
    """Application tracker. Created when the candidate applies from Live jobs,
    or added manually for roles found elsewhere."""

    class Status(models.TextChoices):
        APPLIED = "applied"
        INTERVIEWING = "interviewing"
        OFFER = "offer"
        REJECTED = "rejected"
        WITHDRAWN = "withdrawn"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="job_applications")
    job = models.ForeignKey(Job, null=True, blank=True, on_delete=models.SET_NULL, related_name="applications")
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.APPLIED)
    notes = models.TextField(blank=True)
    applied_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-applied_at"]
        constraints = [models.UniqueConstraint(fields=["user", "job"], name="uniq_application_user_job")]
