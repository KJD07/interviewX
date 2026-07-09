from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0002_paymentorder_plan_alter_paymentorder_amount"),
    ]

    operations = [
        migrations.AlterField(
            model_name="paymentorder",
            name="plan",
            field=models.CharField(
                blank=True,
                default="max",
                help_text="Plan this order is for: pro | premium | max. Blank for top-up orders.",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="paymentorder",
            name="topup_pack",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Top-up pack this order is for: spark | boost | power. Blank for plan orders.",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="paymentorder",
            name="topup_credits",
            field=models.IntegerField(
                default=0,
                help_text="Interview credits granted by this order, if it's a top-up.",
            ),
        ),
    ]
