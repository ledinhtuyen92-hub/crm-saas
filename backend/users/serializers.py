from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import Company, Permission, Role

User = get_user_model()


# ─────────────────────────────────────────────
# Permission
# ─────────────────────────────────────────────

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "name", "module"]


# ─────────────────────────────────────────────
# Role (Vai trò / Chức danh)
# ─────────────────────────────────────────────

class RoleSerializer(serializers.ModelSerializer):
    company = serializers.PrimaryKeyRelatedField(read_only=True)
    permissions = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        many=True,
        required=False,
    )
    permission_details = PermissionSerializer(
        source="permissions",
        many=True,
        read_only=True,
    )
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            "id",
            "company",
            "name",
            "description",
            "permissions",
            "permission_details",
            "user_count",
        ]

    def get_user_count(self, obj):
        return obj.users.count()

    def validate_name(self, value):
        request = self.context["request"]
        company = request.user.company
        if company is None:
            raise serializers.ValidationError(
                "Superadmin hệ thống phải được gán công ty trước khi tạo vai trò."
            )
        queryset = Role.objects.filter(company=company, name__iexact=value.strip())
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Tên vai trò đã tồn tại trong công ty.")
        return value.strip()


# ─────────────────────────────────────────────
# User (Người dùng / Nhân viên)
# ─────────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    company = serializers.PrimaryKeyRelatedField(read_only=True)
    company_name = serializers.CharField(source="company.name", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "full_name",
            "phone",
            "job_title",
            "company",
            "company_name",
            "role",
            "role_name",
            "permissions",
            "is_superuser",
            "is_company_admin",
            "is_active",
            "department_id",
            "created_at",
        ]
        read_only_fields = ["created_at", "permissions", "is_superuser"]

    def get_permissions(self, obj):
        """Trả về danh sách permission code của user."""
        return list(obj.get_permission_codes())

    def validate(self, attrs):
        request = self.context["request"]
        # Với superuser đang gán company cho user khác, bỏ qua validation company
        acting_user = request.user
        company = acting_user.company

        role = attrs.get("role", getattr(self.instance, "role", None))
        if company is None and not acting_user.is_superuser:
            raise serializers.ValidationError(
                "Tài khoản của bạn chưa được gán công ty."
            )
        if role and company and role.company_id != company.id:
            raise serializers.ValidationError(
                {"role": "Vai trò không thuộc công ty của người dùng hiện tại."}
            )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "Mật khẩu là bắt buộc."})
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            instance.save(update_fields=["password"])
        return instance


# ─────────────────────────────────────────────
# Company (dành cho System Admin)
# ─────────────────────────────────────────────

class CompanySerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()
    owner_email = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "workspace_id",
            "tax_code",
            "address",
            "is_active",
            "created_at",
            "user_count",
            "owner_email",
        ]
        read_only_fields = ["created_at"]

    def get_user_count(self, obj):
        return obj.users.count()

    def get_owner_email(self, obj):
        owner = obj.users.filter(is_company_admin=True).first()
        return owner.email if owner else None

    def validate_workspace_id(self, value):
        value = value.strip().upper().replace(" ", "")
        qs = Company.objects.filter(workspace_id__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Workspace ID này đã được sử dụng.")
        return value

    def validate_tax_code(self, value):
        value = value.strip()
        qs = Company.objects.filter(tax_code__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Mã số thuế đã được đăng ký.")
        return value


# ─────────────────────────────────────────────
# Company Registration (Đăng ký công ty mới)
# ─────────────────────────────────────────────

class CompanyRegistrationSerializer(serializers.Serializer):
    # Thông tin công ty
    company_name = serializers.CharField(max_length=255)
    workspace_id = serializers.SlugField(
        max_length=60,
        required=False,
        allow_blank=True,
        help_text="Để trống để tự động tạo từ mã số thuế.",
    )
    tax_code = serializers.CharField(max_length=50)
    address = serializers.CharField(required=False, allow_blank=True, default="")

    # Tài khoản Owner
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")

    def validate_tax_code(self, value):
        value = value.strip()
        if Company.objects.filter(tax_code__iexact=value).exists():
            raise serializers.ValidationError("Mã số thuế đã được đăng ký.")
        return value

    def validate_workspace_id(self, value):
        if not value:
            return value
        value = value.strip().upper().replace(" ", "")
        if Company.objects.filter(workspace_id__iexact=value).exists():
            raise serializers.ValidationError("Workspace ID này đã được sử dụng.")
        return value

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Tên đăng nhập đã tồn tại.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email đã tồn tại.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        from .models import Permission

        workspace_id = validated_data.get("workspace_id") or None
        company = Company.objects.create(
            name=validated_data["company_name"],
            workspace_id=workspace_id or "",  # models.save() sẽ auto-generate nếu rỗng
            tax_code=validated_data["tax_code"],
            address=validated_data["address"],
        )

        # Tạo vai trò "Giám đốc" mặc định với toàn bộ quyền
        director_role = Role.objects.create(
            company=company,
            name="Giám đốc",
            description="Vai trò quản trị cao nhất của công ty.",
        )
        director_role.permissions.set(Permission.objects.all())

        # Tạo tài khoản Owner (is_company_admin=True)
        owner = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            phone=validated_data["phone"],
            job_title="Giám đốc",
            company=company,
            role=director_role,
            is_company_admin=True,
        )
        return owner

    def to_representation(self, instance):
        return {
            "company": {
                "id": instance.company_id,
                "name": instance.company.name,
                "workspace_id": instance.company.workspace_id,
                "tax_code": instance.company.tax_code,
                "address": instance.company.address,
                "created_at": instance.company.created_at,
            },
            "user": UserSerializer(instance, context=self.context).data,
        }


# ─────────────────────────────────────────────
# Change Password
# ─────────────────────────────────────────────

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mật khẩu cũ không đúng.")
        return value
