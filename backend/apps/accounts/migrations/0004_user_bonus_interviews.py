from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_alter_user_subscription_plan"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="bonus_interviews",
            field=models.IntegerField(
                default=0,
                help_text=(
                    "Extra interview credits bought mid-cycle via top-up packs. "
                    "Consumed before counting against the monthly plan limit, and "
                    "do NOT reset on billing renewal — unused credits roll over."
                ),
            ),
        ),
    ]
