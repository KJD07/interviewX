from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("interviews", "0003_interviewsession_duration_minutes_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="interviewsession",
            name="insights",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
