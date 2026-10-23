from django.db import migrations


def seed(apps, schema_editor):
    from apps.companies.skill_bank import sync_skill_bank

    sync_skill_bank(
        apps.get_model("companies", "Company"),
        apps.get_model("companies", "Role"),
        apps.get_model("companies", "Round"),
        apps.get_model("companies", "InterviewQuestion"),
    )
    try:  # the skills list is cached per plan; an empty list may be cached already
        from core.read_cache import invalidate_company_catalog_cache

        invalidate_company_catalog_cache()
    except Exception:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ("companies", "0009_company_organization_alter_company_kind"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
