from django.db import migrations, models

# Frozen copy of feeds.LEVEL_YEARS. Rows are backfilled from their level; the next
# sweep (or opening a lazily-described job) refines them from the posting text.
LEVEL_YEARS = {"entry": (0, 1), "mid": (2, 5), "senior": (5, None)}


def backfill_years(apps, schema_editor):
    Job = apps.get_model("careers", "Job")
    for level, (lo, hi) in LEVEL_YEARS.items():
        Job.objects.filter(level=level).update(exp_min=lo, exp_max=hi)
    Job.objects.filter(exp_min__isnull=True).update(exp_min=2, exp_max=5)


class Migration(migrations.Migration):

    dependencies = [
        ("careers", "0004_more_job_board_ats"),
    ]

    operations = [
        migrations.AddField(
            model_name="job",
            name="exp_min",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="job",
            name="exp_max",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_years, migrations.RunPython.noop),
    ]
