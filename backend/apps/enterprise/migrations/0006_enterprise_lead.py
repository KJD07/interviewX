from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("enterprise", "0005_referral_system"),
    ]

    operations = [
        migrations.CreateModel(
            name="EnterpriseLead",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("company_name", models.CharField(max_length=200)),
                ("contact_name", models.CharField(blank=True, default="", max_length=120)),
                ("contact_email", models.EmailField(max_length=254)),
                (
                    "seats_needed",
                    models.PositiveIntegerField(
                        default=50,
                        help_text="Estimated number of candidate interviews the org needs.",
                    ),
                ),
                ("referral_code", models.CharField(blank=True, default="", max_length=40)),
                ("message", models.TextField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("new", "New"),
                            ("contacted", "Contacted"),
                            ("converted", "Converted"),
                            ("closed_lost", "Closed lost"),
                        ],
                        default="new",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "organization",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="source_lead",
                        to="enterprise.organization",
                    ),
                ),
                (
                    "referral_partner",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="leads",
                        to="enterprise.referralpartner",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
