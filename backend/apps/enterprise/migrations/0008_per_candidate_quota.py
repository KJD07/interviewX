# Generated manually — backfill candidates_used to distinct invite emails.

from django.db import migrations, models
from django.db.models.functions import Lower


def backfill_candidates_used(apps, schema_editor):
    Organization = apps.get_model("enterprise", "Organization")
    OrgCandidateInvite = apps.get_model("enterprise", "OrgCandidateInvite")

    for org in Organization.objects.all().iterator():
        used = (
            OrgCandidateInvite.objects.filter(organization_id=org.pk)
            .annotate(email_lower=Lower("candidate_email"))
            .values("email_lower")
            .distinct()
            .count()
        )
        if org.candidates_used != used:
            Organization.objects.filter(pk=org.pk).update(candidates_used=used)


class Migration(migrations.Migration):

    dependencies = [
        ("enterprise", "0007_referral_partner_pending_and_discount"),
    ]

    operations = [
        migrations.AlterField(
            model_name="organization",
            name="candidate_quota",
            field=models.PositiveIntegerField(
                default=50,
                help_text="Total unique candidate emails this org's contract covers.",
            ),
        ),
        migrations.AlterField(
            model_name="organization",
            name="candidates_used",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Distinct candidate emails that have been invited at least once.",
            ),
        ),
        migrations.RunPython(backfill_candidates_used, migrations.RunPython.noop),
    ]
