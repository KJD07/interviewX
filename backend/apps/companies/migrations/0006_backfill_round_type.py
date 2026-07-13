from django.db import migrations


def infer_round_type(title: str) -> str:
    t = title.lower()
    if "hr" in t or "leadership" in t or "googleyness" in t:
        return "hr"
    if "system design" in t or "design" in t or "architecture" in t or "scalab" in t:
        return "system_design"
    if "behav" in t or "culture" in t or "manager" in t:
        return "behavioral"
    return "technical"


def backfill_round_type(apps, schema_editor):
    Round = apps.get_model("companies", "Round")
    for round_obj in Round.objects.all():
        round_obj.round_type = infer_round_type(round_obj.title)
        round_obj.save(update_fields=["round_type"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("companies", "0005_round_round_type"),
    ]

    operations = [
        migrations.RunPython(backfill_round_type, noop),
    ]
