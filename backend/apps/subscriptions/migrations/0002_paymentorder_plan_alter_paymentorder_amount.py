from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="paymentorder",
            name="plan",
            field=models.CharField(
                default="max",
                help_text="Plan this order is for: pro | premium | max",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="paymentorder",
            name="amount",
            field=models.IntegerField(
                help_text="Amount in paise, e.g. 19900 = ₹199"
            ),
        ),
    ]
