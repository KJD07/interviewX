from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_auth_provider_user_google_sub_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="subscription_plan",
            field=models.CharField(
                default="free",
                help_text="free | pro | premium | max",
                max_length=20,
            ),
        ),
    ]
