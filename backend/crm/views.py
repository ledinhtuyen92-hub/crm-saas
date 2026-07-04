from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.views import TenantQuerySetMixin

from .models import Customer, CustomerContact, CustomerInteraction, CustomerTag
from .serializers import (
    CustomerContactSerializer,
    CustomerInteractionSerializer,
    CustomerSerializer,
    CustomerTagSerializer,
)


class CustomerTagViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD Tags khách hàng — cô lập theo company."""

    queryset = CustomerTag.objects.select_related("company").order_by("name")
    serializer_class = CustomerTagSerializer
    permission_classes = [permissions.IsAuthenticated]


class CustomerViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD khách hàng — luôn filter theo company của user đang đăng nhập."""

    queryset = Customer.objects.select_related(
        "company", "assigned_to", "created_by"
    ).prefetch_related("contacts", "interactions", "tags").order_by("-created_at")
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Nhân viên Sale chỉ xem khách được phân công (trừ khi có quyền crm.view_all)
        if not user.is_company_admin and not user.is_superuser:
            if not user.has_perm_code("crm.view_all"):
                qs = qs.filter(assigned_to=user)
        # Filter theo trạng thái nếu có query param
        customer_status = self.request.query_params.get("status")
        if customer_status:
            qs = qs.filter(status=customer_status)
        # Filter theo assigned_to nếu có query param (dành cho manager)
        assigned_to = self.request.query_params.get("assigned_to")
        if assigned_to:
            qs = qs.filter(assigned_to_id=assigned_to)
        # Tìm kiếm theo tên hoặc SĐT
        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(name__icontains=search) | Q(phone__icontains=search))
        return qs

    def perform_create(self, serializer):
        company = self.request.user.company
        serializer.save(company=company, created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """
        POST /api/crm/customers/{id}/assign/
        Gán thủ công một Sale cụ thể cho khách hàng.
        Yêu cầu quyền: crm.assign hoặc company admin.
        Body: { "assigned_to": <user_id> }
        """
        customer = self.get_object()

        if not request.user.is_company_admin and not request.user.has_perm_code("crm.assign"):
            return Response(
                {"detail": "Bạn không có quyền phân công khách hàng."},
                status=status.HTTP_403_FORBIDDEN,
            )

        assigned_to_id = request.data.get("assigned_to")
        if not assigned_to_id:
            return Response(
                {"detail": "Vui lòng cung cấp 'assigned_to' (ID nhân viên)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from users.models import User
        try:
            sale_user = User.objects.get(
                id=assigned_to_id,
                company=request.user.company,
                is_active=True,
            )
        except User.DoesNotExist:
            return Response(
                {"detail": "Nhân viên không tồn tại hoặc không thuộc công ty này."},
                status=status.HTTP_404_NOT_FOUND,
            )

        customer._assigned_by = request.user  # Signal sẽ đọc để biết ai gán
        customer.assigned_to = sale_user
        customer.save(update_fields=["assigned_to", "updated_at"])

        return Response(CustomerSerializer(customer, context={"request": request}).data)

    @action(detail=False, methods=["post"], url_path="round-robin-assign")
    def round_robin_assign(self, request):
        """
        POST /api/crm/customers/round-robin-assign/
        Phân bổ tự động khách hàng chưa có nhân viên theo Round-robin.
        Chỉ Company Admin mới gọi được.
        """
        if not request.user.is_company_admin:
            return Response(
                {"detail": "Chỉ Quản lý mới có thể thực hiện Round-robin."},
                status=status.HTTP_403_FORBIDDEN,
            )

        from users.models import User
        from django.db.models import Count

        company = request.user.company

        # Lấy danh sách Sale đang hoạt động
        sale_users = list(
            User.objects.filter(
                company=company,
                is_active=True,
                is_company_admin=False,
                is_superuser=False,
            ).annotate(
                customer_count=Count("assigned_customers")
            ).order_by("customer_count")  # Gán cho người ít khách nhất trước
        )

        if not sale_users:
            return Response(
                {"detail": "Không có nhân viên Sale nào đang hoạt động."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        unassigned = Customer.objects.filter(
            company=company,
            assigned_to__isnull=True,
        )

        assigned_count = 0
        for i, customer in enumerate(unassigned):
            sale = sale_users[i % len(sale_users)]
            customer._assigned_by = request.user
            customer.assigned_to = sale
            customer.save(update_fields=["assigned_to", "updated_at"])
            assigned_count += 1

        return Response(
            {"detail": f"Đã phân bổ {assigned_count} khách hàng theo Round-robin."},
            status=status.HTTP_200_OK,
        )


class CustomerContactViewSet(viewsets.ModelViewSet):
    """CRUD đầu mối liên hệ — filter qua customer.company."""

    queryset = CustomerContact.objects.select_related("customer__company").order_by("name")
    serializer_class = CustomerContactSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser and user.company_id is None:
            return super().get_queryset()
        qs = self.queryset.filter(customer__company=user.company)
        customer_id = self.request.query_params.get("customer_id")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        return qs


class CustomerInteractionViewSet(viewsets.ModelViewSet):
    """CRUD lịch sử chăm sóc — filter qua customer.company."""

    queryset = CustomerInteraction.objects.select_related(
        "customer__company", "created_by"
    ).order_by("-created_at")
    serializer_class = CustomerInteractionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser and user.company_id is None:
            return super().get_queryset()
        qs = self.queryset.filter(customer__company=user.company)
        # Lọc theo customer nếu có query param
        customer_id = self.request.query_params.get("customer_id")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
