from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Company, CompanySettings, Permission, Role
from .permissions import IsCompanyAdmin, IsSuperAdmin
from .serializers import (
    ChangePasswordSerializer,
    CompanyRegistrationSerializer,
    CompanySerializer,
    CompanySettingsSerializer,
    PermissionSerializer,
    RoleSerializer,
    UserQuotaSerializer,
    UserSerializer,
    SystemSettingsSerializer,
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

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Lấy expiration time từ cấu hình hệ thống thay vì fix cứng trong settings.py
        from .models import SystemSettings
        from datetime import timedelta
        import datetime
        
        settings = SystemSettings.load()
        # Tính lại ngày hết hạn dựa vào jwt_expiration_hours
        exp_time = datetime.datetime.utcnow() + timedelta(hours=settings.jwt_expiration_hours)
        token['exp'] = int(exp_time.timestamp())
        
        return token


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
        
        from .models import SystemSettings
        settings = SystemSettings.load()
        
        # Ở chế độ Relaxed, Superadmin luôn xem được tất cả dữ liệu (không bị khoá vào công ty của mình)
        # Ở chế độ Strict, Superadmin nếu bị gán vào 1 công ty thì chỉ xem được dữ liệu công ty đó
        if user.is_superuser:
            if settings.tenant_isolation_mode == 'relaxed' or user.company_id is None:
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

    def post(self, request, *args, **kwargs):
        from .models import SystemSettings
        settings = SystemSettings.load()
        if not settings.enable_public_registration:
            from rest_framework import status
            from rest_framework.response import Response
            return Response(
                {"detail": "Tính năng đăng ký hiện đang tạm khóa bởi Quản trị viên."},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().post(request, *args, **kwargs)



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
        # Ẩn tài khoản superuser khỏi danh sách nếu người dùng hiện tại không phải superuser
        if not self.request.user.is_superuser:
            qs = qs.filter(is_superuser=False)
        return qs

    def perform_create(self, serializer):
        company = self.get_company()
        if company is None:
            raise serializers.ValidationError(
                {"company": "Superadmin hệ thống phải được gán công ty để tạo nhân viên."}
            )
        # Kiểm tra giới hạn số nhân viên
        current_count = User.objects.filter(company=company, is_active=True).count()
        if company.user_limit and current_count >= company.user_limit:
            raise serializers.ValidationError(
                f"Đã đạt giới hạn số nhân viên ({company.user_limit}). "
                f"Vui lòng nâng cấp gói dịch vụ."
            )
        serializer.save(company=company)

    def perform_destroy(self, instance):
        if instance.is_superuser:
            raise serializers.ValidationError(
                "Không thể xóa tài khoản Quản trị hệ thống (Superadmin)!"
            )
        super().perform_destroy(instance)

    from rest_framework.decorators import action
    from rest_framework.response import Response
    from rest_framework import status

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get("new_password")
        if not new_password:
            return Response({"new_password": "Vui lòng nhập mật khẩu mới."}, status=status.HTTP_400_BAD_REQUEST)
        
        from .serializers import validate_strong_password
        try:
            validate_strong_password(new_password)
        except serializers.ValidationError as e:
            return Response({"new_password": e.detail}, status=status.HTTP_400_BAD_REQUEST)
            
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": f"Đã đặt lại mật khẩu thành công cho {user.username}."})


# ─────────────────────────────────────────────
# Permission ViewSet (Read-only)
# ─────────────────────────────────────────────

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """GET permissions — dùng để hiển thị danh sách quyền khi cấu hình vai trò."""

    queryset = Permission.objects.all().order_by("module", "code")
    serializer_class = PermissionSerializer
    permission_classes = [IsCompanyAdmin]


# ─────────────────────────────────────────────
# CompanySettings API
# ─────────────────────────────────────────────

class CompanySettingsView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/users/company-settings/  — Lấy cài đặt hiện tại của công ty.
    PATCH /api/users/company-settings/ — Cập nhật cài đặt.
    Chỉ Company Admin mới có quyền.
    """

    serializer_class = CompanySettingsSerializer
    permission_classes = [IsCompanyAdmin]
    http_method_names = ["get", "patch"]

    def get_object(self):
        settings_obj, _ = CompanySettings.objects.get_or_create(
            company=self.request.user.company
        )
        return settings_obj


# ─────────────────────────────────────────────
# System Settings API (Superadmin only)
# ─────────────────────────────────────────────

class SystemSettingsView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/users/system-settings/  — Lấy cấu hình toàn hệ thống.
    PATCH /api/users/system-settings/ — Cập nhật cấu hình toàn hệ thống.
    """
    serializer_class = SystemSettingsSerializer
    permission_classes = [IsSuperAdmin]

    def get_object(self):
        from .models import SystemSettings
        return SystemSettings.load()

# ─────────────────────────────────────────────
# Subscription Plan API
# ─────────────────────────────────────────────

from .models import SubscriptionPlan
from .serializers import SubscriptionPlanSerializer

class SubscriptionPlanViewSet(viewsets.ModelViewSet):
    """
    CRUD cho Gói đăng ký.
    - Superadmin: Toàn quyền.
    - User thường (kể cả chưa auth, hoặc auth): Chỉ được GET để xem danh sách gói.
    """
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer
    
    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsSuperAdmin()]


# ─────────────────────────────────────────────
# Public Settings API (AllowAny)
# ─────────────────────────────────────────────

class PublicSettingsView(APIView):
    """
    GET /api/users/public-settings/ — Lấy cấu hình public (ví dụ: enable_public_registration).
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from .models import SystemSettings
        settings = SystemSettings.load()
        return Response({
            "enable_public_registration": settings.enable_public_registration
        })


# ─────────────────────────────────────────────
# User quota check endpoint
# ─────────────────────────────────────────────

class UserQuotaView(APIView):
    """
    GET /api/users/quota/ — Trả về thông tin hạn mức (quota) tài khoản nhân viên của công ty.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = request.user.company
        if not company:
            return Response(
                {"detail": "Tài khoản không thuộc công ty nào."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        active_users = User.objects.filter(company=company, is_active=True).count()
        user_limit = company.user_limit
        if user_limit is not None:
            remaining_users = max(0, user_limit - active_users)
            can_add_user = active_users < user_limit
        else:
            remaining_users = None
            can_add_user = True

        serializer = UserQuotaSerializer({
            "user_limit": user_limit,
            "active_users": active_users,
            "remaining_users": remaining_users,
            "can_add_user": can_add_user,
        })
        return Response(serializer.data)

