from django.db import migrations, models

# Companies that are accessible to free-plan users out of the box.
# Edit this list any time — it's just a data seed, not a hard rule.
FREE_COMPANY_NAMES = ["TCS", "Infosys", "Amazon"]


def mark_free_companies(apps, schema_editor):
    Company = apps.get_model("companies", "Company")
    Company.objects.filter(name__in=FREE_COMPANY_NAMES).update(is_free=True)


def unmark_free_companies(apps, schema_editor):
    Company = apps.get_model("companies", "Company")
    Company.objects.filter(name__in=FREE_COMPANY_NAMES).update(is_free=False)


class Migration(migrations.Migration):

    dependencies = [
        ("companies", "0002_interviewquestion_generated_by_ai"),
    ]

    operations = [
        migrations.AddField(
            model_name="company",
            name="is_free",
            field=models.BooleanField(
                default=False,
                help_text="If true, free-plan users can access this company. Paid plans always see all companies.",
            ),
        ),
        migrations.RunPython(mark_free_companies, unmark_free_companies),
    ]
