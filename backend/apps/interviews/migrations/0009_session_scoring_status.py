from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("interviews", "0008_realinterviewreport_round_name_unique"),
    ]

    operations = [
        migrations.AddField(
            model_name="interviewsession",
            name="scoring_error",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="interviewsession",
            name="status",
            field=models.CharField(
                choices=[
                    ("in_progress", "In Progress"),
                    ("scoring", "Scoring"),
                    ("completed", "Completed"),
                    ("abandoned", "Abandoned"),
                ],
                default="in_progress",
                max_length=20,
            ),
        ),
    ]
