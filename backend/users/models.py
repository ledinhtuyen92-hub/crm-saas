from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify


class Company(models.Model):
    name = models.CharField(max_length=255, verbose_name="Tên công ty")
    workspace_id = models.SlugField(
        max_length=60,
        unique=True,
        verbose_name="Workspace ID",
        help_text="Mã định danh công ty khi đăng nhập (vd: ANPHAT). Tự động tạo từ mã số thuế nếu để trống.",
    )
    tax_code = models.CharField(max_length=50, unique=True, verbose_name="Mã số thuế")
    address = models.TextField(blank=True, verbose_name="Địa chỉ")
    is_active = models.BooleanField(default=True, verbose_name="Đang hoạt động")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Công ty"
        verbose_name_plural = "Công ty"

    def save(self, *args, **kwargs):
        # Tự động generate workspace_id từ tax_code nếu chưa có
        if not self.workspace_id:
            self.workspace_id = slugify(self.tax_code).upper().replace("-", "")
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True, verbose_name="Mã quyền")
    name = models.CharField(max_length=150, verbose_name="Tên quyền")
    module = models.CharField(
        max_length=50,
        blank=True,
        default="",
        verbose_name="Module",
        help_text="Tên module chứa quyền này (vd: crm, sales, inventory...)",
    )

    class Meta:
        ordering = ["module", "code"]
        verbose_name = "Quyền"
        verbose_name_plural = "Quyền"

    def __str__(self):
        return f"{self.name} ({self.code})"


class Role(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="roles",
        verbose_name="Công ty",
    )
    name = models.CharField(max_length=150, verbose_name="Tên vai trò")
    description = models.TextField(blank=True, verbose_name="Mô tả")
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="roles",
        verbose_name="Danh sách quyền",
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Vai trò"
        verbose_name_plural = "Vai trò"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                name="unique_role_name_per_company",
            )
        ]

    def __str__(self):
        return f"{self.name} — {self.company.name}"


class User(AbstractUser):
    email = models.EmailField(unique=True, verbose_name="Email")
    full_name = models.CharField(max_length=255, verbose_name="Họ và tên")
    phone = models.CharField(max_length=20, blank=True, verbose_name="Số điện thoại")
    job_title = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="Chức danh",
        help_text="Chức danh hiển thị (vd: Giám đốc kinh doanh, Kế toán trưởng...)",
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
        verbose_name="Công ty",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        related_name="users",
        null=True,
        blank=True,
        verbose_name="Vai trò",
    )
    is_company_admin = models.BooleanField(
        default=False,
        verbose_name="Là Admin công ty",
        help_text="Tài khoản quản trị cao nhất của công ty (Owner/Giám đốc). Có toàn quyền trong công ty.",
    )
    department_id = models.IntegerField(null=True, blank=True, verbose_name="Phòng ban")
    created_at = models.DateTimeField(auto_now_add=True)

    REQUIRED_FIELDS = ["email", "full_name"]

    class Meta:
        verbose_name = "Người dùng"
        verbose_name_plural = "Người dùng"

    def get_permission_codes(self):
        """Trả về set các permission code của user."""
        if self.is_superuser or self.is_company_admin:
            # Admin có toàn bộ quyền
            return set(Permission.objects.values_list("code", flat=True))
        if not self.role:
            return set()
        return set(self.role.permissions.values_list("code", flat=True))

    def clean(self):
        super().clean()
        if self.role_id and self.company_id != self.role.company_id:
            raise ValidationError({"role": "Vai trò phải thuộc cùng công ty với người dùng."})

    def __str__(self):
        return self.full_name or self.username
