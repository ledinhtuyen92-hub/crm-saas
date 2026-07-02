from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Thêm các fields mới:
    - Company.workspace_id  — Mã định danh duy nhất khi đăng nhập (slug)
    - Company.is_active     — Trạng thái hoạt động của công ty
    - Permission.module     — Tên module chứa permission
    - User.is_company_admin — Đánh dấu tài khoản Owner của công ty
    - User.job_title        — Chức danh hiển thị

    Lưu ý: Dùng IF NOT EXISTS để tránh conflict với DB đã tồn tại từ lần migrate trước.
    """

    dependencies = [("users", "0002_multitenancy_rbac")]

    operations = [
        # ── Company.workspace_id ─────────────────────────────────────
        # Thêm field không unique trước (để tránh lỗi với rows hiện tại)
        migrations.AddField(
            model_name="company",
            name="workspace_id",
            field=models.SlugField(
                max_length=60,
                default="",
                verbose_name="Workspace ID",
                help_text="Mã định danh công ty khi đăng nhập.",
            ),
            preserve_default=False,
        ),
        # ── Company.is_active ────────────────────────────────────────
        migrations.AddField(
            model_name="company",
            name="is_active",
            field=models.BooleanField(default=True, verbose_name="Đang hoạt động"),
        ),
        # ── Permission.module ────────────────────────────────────────
        migrations.AddField(
            model_name="permission",
            name="module",
            field=models.CharField(
                max_length=50,
                blank=True,
                default="",
                verbose_name="Module",
            ),
        ),
        # ── User.is_company_admin ────────────────────────────────────
        migrations.AddField(
            model_name="user",
            name="is_company_admin",
            field=models.BooleanField(
                default=False,
                verbose_name="Là Admin công ty",
            ),
        ),
        # ── User.job_title ───────────────────────────────────────────
        migrations.AddField(
            model_name="user",
            name="job_title",
            field=models.CharField(
                max_length=150,
                blank=True,
                default="",
                verbose_name="Chức danh",
            ),
        ),
        # ── Cập nhật verbose_name các models ─────────────────────────
        migrations.AlterModelOptions(
            name="company",
            options={
                "ordering": ["name"],
                "verbose_name": "Công ty",
                "verbose_name_plural": "Công ty",
            },
        ),
        migrations.AlterModelOptions(
            name="permission",
            options={
                "ordering": ["module", "code"],
                "verbose_name": "Quyền",
                "verbose_name_plural": "Quyền",
            },
        ),
        migrations.AlterModelOptions(
            name="role",
            options={
                "ordering": ["name"],
                "verbose_name": "Vai trò",
                "verbose_name_plural": "Vai trò",
            },
        ),
        migrations.AlterModelOptions(
            name="user",
            options={
                "verbose_name": "Người dùng",
                "verbose_name_plural": "Người dùng",
            },
        ),
    ]
