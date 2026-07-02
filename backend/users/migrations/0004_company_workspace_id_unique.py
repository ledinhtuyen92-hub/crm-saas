from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Áp dụng unique constraint cho Company.workspace_id.
    Tách riêng khỏi 0003 để tránh lỗi DuplicateTable khi DB đã có index cũ.
    """

    dependencies = [("users", "0003_add_workspace_id_company_admin_job_title")]

    operations = [
        migrations.AlterField(
            model_name="company",
            name="workspace_id",
            field=models.SlugField(
                max_length=60,
                unique=True,
                verbose_name="Workspace ID",
                help_text="Mã định danh công ty khi đăng nhập (vd: ANPHAT). Tự động tạo từ MST nếu để trống.",
            ),
        ),
    ]
