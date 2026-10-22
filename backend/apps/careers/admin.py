from django.contrib import admin

from .models import Job, ResumeCheck

admin.site.register(Job, list_display=("title", "company", "source", "posted_at"), search_fields=("title", "company"))
admin.site.register(ResumeCheck, list_display=("user", "job", "ats_score", "created_at"))
