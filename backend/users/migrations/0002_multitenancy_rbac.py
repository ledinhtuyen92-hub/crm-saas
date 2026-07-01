import django.db.models.deletion
from django.db import migrations, models


def assign_legacy_company(apps, schema_editor):
    Company = apps.get_model("users", "Company")
    Role = apps.get_model("users", "Role")
    User = apps.get_model("users", "User")

    if not Role.objects.exists() and not User.objects.exists():
        return

    company, _ = Company.objects.get_or_create(
        tax_code="LEGACY",
        defaults={
            "name": "Legacy Company",
            "address": "Dữ liệu được chuyển đổi từ hệ thống cũ",
        },
    )
    Role.objects.filter(company__isnull=True).update(company=company)
    User.objects.filter(company__isnull=True).update(company=company)


def remove_unused_legacy_company(apps, schema_editor):
    Company = apps.get_model("users", "Company")
    Company.objects.filter(tax_code="LEGACY", roles__isnull=True, users__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [("users", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="Company",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("tax_code", models.CharField(max_length=50, unique=True)),
                ("address", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"verbose_name_plural": "companies", "ordering": ["name"]},
        ),
        migrations.AlterModelOptions(
            name="permission",
            options={"ordering": ["code"]},
        ),
        migrations.AlterModelOptions(
            name="role",
            options={"ordering": ["name"]},
        ),
        migrations.AlterField(
            model_name="role",
            name="name",
            field=models.CharField(max_length=150),
        ),
        migrations.AddField(
            model_name="role",
            name="company",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="roles",
                to="users.company",
            ),
        ),
        migrations.AddField(
            model_name="role",
            name="permissions",
            field=models.ManyToManyField(
                blank=True,
                related_name="roles",
                to="users.permission",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="company",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="users",
                to="users.company",
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="users",
                to="users.role",
            ),
        ),
        migrations.RunPython(assign_legacy_company, remove_unused_legacy_company),
        migrations.AlterField(
            model_name="role",
            name="company",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="roles",
                to="users.company",
            ),
        ),
        migrations.AddConstraint(
            model_name="role",
            constraint=models.UniqueConstraint(
                fields=("company", "name"),
                name="unique_role_name_per_company",
            ),
        ),
    ]
