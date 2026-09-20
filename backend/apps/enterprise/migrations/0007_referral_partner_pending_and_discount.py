from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("enterprise", "0006_enterprise_lead"),
    ]

    operations = [
        migrations.AddField(
            model_name="referralpartner",
            name="contact_phone",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Contact number submitted with the partner access request.",
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name="referralpartner",
            name="candidate_discount_percent",
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text="Percent off practice plan purchases for candidates using this partner code (0–100).",
            ),
        ),
        migrations.AlterField(
            model_name="referralpartner",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending approval"),
                    ("active", "Active"),
                    ("paused", "Paused"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]
