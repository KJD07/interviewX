import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("interviews", "0004_interviewsession_insights"),
    ]

    operations = [
        migrations.CreateModel(
            name="RealInterviewReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("had_recent_interview", models.CharField(choices=[("yes", "Yes"), ("no", "No")], max_length=3)),
                ("name", models.CharField(blank=True, max_length=150)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("company_name", models.CharField(blank=True, max_length=200)),
                ("role_title", models.CharField(blank=True, max_length=200)),
                ("rounds", models.JSONField(blank=True, default=list)),
                ("can_provide_proof", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="real_reports",
                        to="interviews.interviewsession",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="real_interview_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]