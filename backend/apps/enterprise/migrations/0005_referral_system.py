# Generated manually for B2B referral system

import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("enterprise", "0004_organization_live_camera_enabled"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ReferralPartner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("contact_email", models.EmailField(max_length=254)),
                ("code", models.CharField(help_text="Unique referral code used in links, e.g. THAPAR20.", max_length=40, unique=True)),
                (
                    "commission_rate",
                    models.DecimalField(
                        decimal_places=4,
                        default=Decimal("0.20"),
                        help_text="Commission rate as a decimal fraction, e.g. 0.20 = 20%.",
                        max_digits=5,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("active", "Active"), ("paused", "Paused")],
                        default="active",
                        max_length=20,
                    ),
                ),
                (
                    "payout_notes",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="Bank/UPI details and payout notes for admin use.",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.OneToOneField(
                        blank=True,
                        help_text="Optional login used for the partner dashboard.",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="referral_partner",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="EnterprisePayment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "amount_paise",
                    models.PositiveIntegerField(
                        help_text="Gross payment amount in paise, e.g. 1999900 = ₹19,999."
                    ),
                ),
                ("description", models.CharField(blank=True, default="", max_length=255)),
                ("paid_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="payments",
                        to="enterprise.organization",
                    ),
                ),
                (
                    "recorded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recorded_enterprise_payments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-paid_at"],
            },
        ),
        migrations.CreateModel(
            name="ReferralAttribution",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "source",
                    models.CharField(
                        choices=[
                            ("link", "Referral link"),
                            ("manual_admin", "Manual admin"),
                            ("code_at_signup", "Code at signup"),
                        ],
                        max_length=30,
                    ),
                ),
                ("attributed_at", models.DateTimeField()),
                (
                    "expires_at",
                    models.DateTimeField(
                        help_text="Commission window ends at this moment (default: 12 months)."
                    ),
                ),
                (
                    "organization",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="referral_attribution",
                        to="enterprise.organization",
                    ),
                ),
                (
                    "partner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attributions",
                        to="enterprise.referralpartner",
                    ),
                ),
            ],
            options={
                "ordering": ["-attributed_at"],
            },
        ),
        migrations.CreateModel(
            name="CommissionLedger",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("gross_amount_paise", models.PositiveIntegerField()),
                ("commission_rate", models.DecimalField(decimal_places=4, max_digits=5)),
                ("commission_amount_paise", models.PositiveIntegerField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("approved", "Approved"),
                            ("paid", "Paid"),
                            ("void", "Void"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "enterprise_payment",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="commission",
                        to="enterprise.enterprisepayment",
                    ),
                ),
                (
                    "partner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="commissions",
                        to="enterprise.referralpartner",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
