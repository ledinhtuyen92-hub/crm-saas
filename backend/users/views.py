from rest_framework import generics, permissions, serializers, viewsets

from .models import Permission, Role, User
from .serializers import (
    CompanyRegistrationSerializer,
    PermissionSerializer,
    RoleSerializer,
    UserSerializer,
)


class CompanyRegistrationView(generics.CreateAPIView):
    serializer_class = CompanyRegistrationSerializer
    permission_classes = [permissions.AllowAny]


class TenantQuerySetMixin:
    def get_company(self):
        return self.request.user.company

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_superuser and self.request.user.company_id is None:
            return queryset
        return queryset.filter(company=self.get_company())

    def perform_create(self, serializer):
        company = self.get_company()
        if company is None:
            raise serializers.ValidationError(
                {"company": "Superadmin hệ thống phải được gán công ty để tạo dữ liệu."}
            )
        serializer.save(company=company)


class RoleViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = Role.objects.select_related("company").prefetch_related("permissions")
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated]


class UserViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = User.objects.select_related("company", "role")
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]
