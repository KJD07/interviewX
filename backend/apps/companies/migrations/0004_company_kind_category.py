from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("companies", "0003_company_is_free"),
    ]

    operations = [
        migrations.AddField(
            model_name="company",
            name="kind",
            field=models.CharField(
                choices=[("company", "Company"), ("skill", "Skill")],
                default="company",
                help_text="'company' = a real company interview. 'skill' = a skill-based practice interview.",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="company",
            name="category",
            field=models.CharField(
                blank=True,
                help_text="Grouping label for skills (e.g. 'Frontend', 'Backend', 'DevOps'). Unused for companies.",
                max_length=100,
            ),
        ),
    ]
