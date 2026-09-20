from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0006_rename_razorpay_fields_to_payu"),
    ]

    operations = [
        migrations.AddField(
            model_name="paymentorder",
            name="partner_code",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Partner referral / coupon code applied to this order, if any.",
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name="paymentorder",
            name="discount_percent",
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text="Partner discount percent applied to the list price for this order.",
            ),
        ),
        migrations.AddField(
            model_name="paymentorder",
            name="list_amount_paise",
            field=models.IntegerField(
                default=0,
                help_text="Pre-discount amount in paise; 0 when no discount was applied.",
            ),
        ),
    ]
