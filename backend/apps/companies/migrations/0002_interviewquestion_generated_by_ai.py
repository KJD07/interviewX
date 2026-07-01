from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("companies", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="interviewquestion",
            name="generated_by_ai",
            field=models.BooleanField(
                default=False,
                help_text="True if sourced automatically from the web via AI, rather than entered by an admin.",
            ),
        ),
    ]