import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("interviews", "0005_realinterviewreport"),
    ]

    operations = [
        migrations.AlterField(
            model_name="realinterviewreport",
            name="session",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="real_reports",
                to="interviews.interviewsession",
            ),
        ),
        migrations.AddField(
            model_name="realinterviewreport",
            name="status",
            field=models.CharField(
                choices=[("pending", "Pending review"), ("approved", "Approved"), ("rejected", "Rejected")],
                default="pending",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="realinterviewreport",
            name="reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
