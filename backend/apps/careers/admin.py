from django.contrib import admin

from .models import CandidateProfile, Job, JobApplication, JobBoard, ResumeCheck, SavedJob

admin.site.register(Job, list_display=("title", "company", "source", "work_mode", "level", "posted_at"),
                    list_filter=("source", "work_mode", "level"), search_fields=("title", "company"))
admin.site.register(JobBoard, list_display=("company", "ats", "token", "is_active", "last_job_count",
                                            "consecutive_failures", "last_fetched_at"),
                    list_filter=("ats", "is_active"), search_fields=("company", "token"))
admin.site.register(ResumeCheck, list_display=("user", "job", "ats_score", "created_at"))
admin.site.register(CandidateProfile, list_display=("user", "full_name", "headline", "resume_parsed_by", "updated_at"),
                    search_fields=("user__email", "full_name"), exclude=("resume_text",))
admin.site.register(SavedJob, list_display=("user", "title", "company", "created_at"))
admin.site.register(JobApplication, list_display=("user", "title", "company", "status", "applied_at"),
                    list_filter=("status",))
