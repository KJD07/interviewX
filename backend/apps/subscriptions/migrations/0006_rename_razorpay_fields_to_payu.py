from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0005_alter_sponsorshipcampaign_email_domain_and_more"),
    ]

    operations = [
        migrations.RenameField(
            model_name="paymentorder",
            old_name="razorpay_order_id",
            new_name="payu_txnid",
        ),
        migrations.RenameField(
            model_name="paymentorder",
            old_name="razorpay_payment_id",
            new_name="payu_payment_id",
        ),
        migrations.RenameField(
            model_name="paymentorder",
            old_name="razorpay_signature",
            new_name="payu_hash",
        ),
    ]
