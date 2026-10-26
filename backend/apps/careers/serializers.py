from rest_framework import serializers

from .models import CandidateProfile, Job, JobApplication, SavedJob
from .profile_parser import ENTRY_FIELDS, LIST_LIMITS


def _string_list(value, limit, item_max=200):
    if not isinstance(value, list):
        raise serializers.ValidationError("Expected a list.")
    out, seen = [], set()
    for item in value:
        s = str(item or "").strip()[:item_max]
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out[:limit]


def _entry_list(value, key):
    if not isinstance(value, list):
        raise serializers.ValidationError("Expected a list.")
    fields = ENTRY_FIELDS[key]
    out = []
    for item in value:
        if not isinstance(item, dict):
            raise serializers.ValidationError("Each entry must be an object.")
        entry = {f: str(item.get(f) or "").strip()[:2000 if f == "description" else 200] for f in fields}
        if any(entry.values()):
            out.append(entry)
    return out[:LIST_LIMITS[key]]


class CandidateProfileSerializer(serializers.ModelSerializer):
    has_resume = serializers.SerializerMethodField()

    class Meta:
        model = CandidateProfile
        fields = [
            "full_name", "headline", "email", "phone", "location", "summary",
            "linkedin_url", "github_url", "portfolio_url", "total_experience_years",
            "skills", "experience", "education", "projects", "certifications",
            "target_roles", "preferred_locations", "work_modes", "experience_level",
            "has_resume", "resume_filename", "resume_uploaded_at", "resume_parsed_by", "updated_at",
        ]
        read_only_fields = ["resume_filename", "resume_uploaded_at", "resume_parsed_by", "updated_at"]

    def get_has_resume(self, obj):
        return bool(obj.resume_text)

    def validate_skills(self, v):
        return _string_list(v, LIST_LIMITS["skills"], 60)

    def validate_certifications(self, v):
        return _string_list(v, LIST_LIMITS["certifications"])

    def validate_target_roles(self, v):
        return _string_list(v, 5, 100)

    def validate_preferred_locations(self, v):
        return _string_list(v, 5, 100)

    def validate_work_modes(self, v):
        modes = _string_list(v, 3, 10)
        bad = [m for m in modes if m not in Job.WorkMode.values]
        if bad:
            raise serializers.ValidationError(f"Unknown work mode: {', '.join(bad)}")
        return modes

    def validate_experience(self, v):
        return _entry_list(v, "experience")

    def validate_education(self, v):
        return _entry_list(v, "education")

    def validate_projects(self, v):
        return _entry_list(v, "projects")


def job_dict(job, with_description=False, saved=False, application=None, match=None, stack_more=0):
    d = {
        "id": job.id, "title": job.title, "company": job.company, "location": job.location,
        "url": job.url, "tags": [t for t in job.tags if t], "posted_at": job.posted_at, "source": job.source,
        "work_mode": job.work_mode, "level": job.level, "exp_min": job.exp_min, "exp_max": job.exp_max,
        "skills": job.skills, "stack_more": stack_more,
        "saved": saved, "application_status": application, "match": match,
    }
    if with_description:
        d["description"] = job.description
    return d


def tracked_dict(row):
    """SavedJob / JobApplication -> JSON, preferring live job data while the posting is open."""
    job = row.job
    d = {
        "id": row.id, "job_id": row.job_id, "is_live": job is not None,
        "title": job.title if job else row.title, "company": job.company if job else row.company,
        "location": job.location if job else row.location, "url": job.url if job else row.url,
    }
    if isinstance(row, SavedJob):
        d["saved_at"] = row.created_at
        d["work_mode"] = job.work_mode if job else ""
        d["posted_at"] = job.posted_at if job else None
    elif isinstance(row, JobApplication):
        d.update(status=row.status, notes=row.notes, applied_at=row.applied_at, updated_at=row.updated_at)
    return d


class ApplicationUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobApplication
        fields = ["status", "notes"]


class ManualApplicationSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=300)
    company = serializers.CharField(max_length=200)
    location = serializers.CharField(max_length=200, required=False, allow_blank=True)
    url = serializers.URLField(max_length=600, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=JobApplication.Status.choices, required=False)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=5000)
