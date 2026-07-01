from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import Company, Permission, Role

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "name"]


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

    class Meta:
        model = Role
        fields = [
            "id",
            "company",
            "name",
            "description",
            "permissions",
            "permission_details",
        ]

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


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    company = serializers.PrimaryKeyRelatedField(read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "full_name",
            "first_name",
            "last_name",
            "phone",
            "company",
            "role",
            "role_name",
            "department_id",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        request = self.context["request"]
        company = request.user.company
        role = attrs.get("role", getattr(self.instance, "role", None))
        if company is None:
            raise serializers.ValidationError(
                "Superadmin hệ thống phải được gán công ty trước khi tạo hoặc sửa người dùng."
            )
        if role and role.company_id != company.id:
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


class CompanyRegistrationSerializer(serializers.Serializer):
    company_name = serializers.CharField(max_length=255)
    tax_code = serializers.CharField(max_length=50)
    address = serializers.CharField(required=False, allow_blank=True, default="")
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
        company = Company.objects.create(
            name=validated_data["company_name"],
            tax_code=validated_data["tax_code"],
            address=validated_data["address"],
        )
        director_role = Role.objects.create(
            company=company,
            name="Giám đốc",
            description="Vai trò quản trị cao nhất của công ty.",
        )
        director_role.permissions.set(Permission.objects.all())

        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            phone=validated_data["phone"],
            company=company,
            role=director_role,
        )

    def to_representation(self, instance):
        return {
            "company": {
                "id": instance.company_id,
                "name": instance.company.name,
                "tax_code": instance.company.tax_code,
                "address": instance.company.address,
                "created_at": instance.company.created_at,
            },
            "user": UserSerializer(instance, context=self.context).data,
        }
