from django.db import migrations


def seed_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    roles = [
        {
            "name": "Super Admin",
            "description": "Platform owner with root permissions",
        },
        {
            "name": "Maintenance Engineer",
            "description": "Handles scheduled equipment maintenance and diagnostics",
        },
        {
            "name": "Service Engineer",
            "description": "Performs direct repairs and equipment servicing",
        },
        {
            "name": "Operator",
            "description": "Monitors machinery and logs operational metrics",
        },
    ]
    for role_data in roles:
        Role.objects.get_or_create(
            name=role_data["name"],
            defaults={"description": role_data["description"]},
        )


def reverse_seed_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    Role.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_roles, reverse_seed_roles),
    ]
