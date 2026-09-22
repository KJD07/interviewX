from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_referralvisit"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="can_view_analytics",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Allows access to the in-app product analytics dashboard at "
                    "/analytics (PostHog-backed). Grant explicitly; not tied to is_staff."
                ),
            ),
        ),
    ]
