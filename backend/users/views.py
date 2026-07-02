from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Company, Permission, Role
from .permissions import IsCompanyAdmin, IsSuperAdmin
from .serializers import (
    ChangePasswordSerializer,
    CompanyRegistrationSerializer,
    CompanySerializer,
    PermissionSerializer,
    RoleSerializer,
    UserSerializer,
)

User = get_user_model()


# ─────────────────────────────────────────────
# Custom JWT Login — validate workspace_id
# ─────────────────────────────────────────────

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Mở rộng TokenObtainPairSerializer để hỗ trợ trường workspace_id.
    - Người dùng thông thường: bắt buộc nhập workspace_id để xác định công ty.
    - Superuser hệ thống: workspace_id là "SYSTEM" hoặc để trống.
    """

    workspace_id = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        workspace_id = attrs.pop("workspace_id", "").strip().upper()

        # Gọi validation gốc để lấy token
        data = super().validate(attrs)

        user = self.user

        # Kiểm tra workspace_id cho tài khoản công ty
        if not user.is_superuser:
            if not workspace_id:
                raise serializers.ValidationError(
                    {"workspace_id": "Vui lòng nhập Mã công ty (Workspace ID)."}
                )
            # Kiểm tra user thuộc đúng công ty
            if not user.company:
                raise serializers.ValidationError(
                    "Tài khoản của bạn chưa được gán vào công ty nào."
                )
            if user.company.workspace_id.upper() != workspace_id:
                raise serializers.ValidationError(
                    {"workspace_id": "Mã công ty không đúng."}
                )
            if not user.company.is_active:
                raise serializers.ValidationError(
                    "Công ty của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên hệ thống."
                )

        if not user.is_active:
            raise serializers.ValidationError(
                "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên."
            )

        # Thêm thông tin user vào response token
        data["user"] = UserSerializer(user, context=self.context).data
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


# ─────────────────────────────────────────────
# Current User Info
# ─────────────────────────────────────────────

class CurrentUserView(APIView):
    """GET /api/users/me/ — Trả về thông tin user đang đăng nhập."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(serializer.data)


# ─────────────────────────────────────────────
# Change Password
# ─────────────────────────────────────────────

class ChangePasswordView(APIView):
    """POST /api/users/change-password/ — Đổi mật khẩu."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Đổi mật khẩu thành công."}, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# Tenant Mixin
# ─────────────────────────────────────────────

class TenantQuerySetMixin:
    """Mixin đảm bảo mọi queryset đều filter theo công ty của user."""

    def get_company(self):
        return self.request.user.company

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        # Superuser không gán công ty thì xem tất cả
        if user.is_superuser and user.company_id is None:
            return queryset
        return queryset.filter(company=self.get_company())

    def perform_create(self, serializer):
        company = self.get_company()
        if company is None:
            raise serializers.ValidationError(
                {"company": "Superadmin hệ thống phải được gán công ty để tạo dữ liệu."}
            )
        serializer.save(company=company)


# ─────────────────────────────────────────────
# Company ViewSet (chỉ System Admin)
# ─────────────────────────────────────────────

class CompanyViewSet(viewsets.ModelViewSet):
    """CRUD công ty — chỉ System Administrator mới được truy cập."""

    queryset = Company.objects.prefetch_related("users").order_by("-created_at")
    serializer_class = CompanySerializer
    permission_classes = [IsSuperAdmin]

    def perform_create(self, serializer):
        serializer.save()


# ─────────────────────────────────────────────
# Company Registration (Đăng ký tự do)
# ─────────────────────────────────────────────

class CompanyRegistrationView(generics.CreateAPIView):
    """POST /api/users/register-company/ — Đăng ký tài khoản công ty mới (không cần auth)."""

    serializer_class = CompanyRegistrationSerializer
    permission_classes = [permissions.AllowAny]


# ─────────────────────────────────────────────
# Role ViewSet (Company Admin)
# ─────────────────────────────────────────────

class RoleViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD vai trò/chức danh trong công ty — chỉ Company Admin mới tạo/sửa/xóa."""

    queryset = Role.objects.select_related("company").prefetch_related("permissions", "users")
    serializer_class = RoleSerializer
    permission_classes = [IsCompanyAdmin]


# ─────────────────────────────────────────────
# User ViewSet (Company Admin)
# ─────────────────────────────────────────────

class UserViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD nhân viên trong công ty — chỉ Company Admin mới tạo/sửa/xóa."""

    queryset = User.objects.select_related("company", "role").prefetch_related("role__permissions")
    serializer_class = UserSerializer
    permission_classes = [IsCompanyAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        # Không trả về chính mình trong danh sách (tuỳ chọn)
        return qs

    def perform_create(self, serializer):
        company = self.get_company()
        if company is None:
            raise serializers.ValidationError(
                {"company": "Superadmin hệ thống phải được gán công ty để tạo nhân viên."}
            )
        serializer.save(company=company)


# ─────────────────────────────────────────────
# Permission ViewSet (Read-only)
# ─────────────────────────────────────────────

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """GET permissions — dùng để hiển thị danh sách quyền khi cấu hình vai trò."""

    queryset = Permission.objects.all().order_by("module", "code")
    serializer_class = PermissionSerializer
    permission_classes = [IsCompanyAdmin]
