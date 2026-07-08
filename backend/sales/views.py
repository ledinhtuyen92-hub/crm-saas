from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from users.views import TenantQuerySetMixin
from users.permissions import ActionBasedPermission

from .models import Quotation, QuotationItem, QuotationTemplate
from .serializers import QuotationItemSerializer, QuotationSerializer, QuotationTemplateSerializer


class QuotationViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD báo giá — cô lập theo company."""

    queryset = Quotation.objects.select_related(
        "company", "customer", "created_by"
    ).prefetch_related("items").order_by("-created_at")
    serializer_class = QuotationSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": ["sales.view", "sales.create", "sales.edit"],
        "retrieve": ["sales.view", "sales.create", "sales.edit"],
        "create": "sales.create",
        "update": ["sales.create", "sales.edit"],
        "partial_update": ["sales.create", "sales.edit"],
        "destroy": "sales.delete",
        "create_order": ["sales.view", "sales.create", "sales.edit"],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Phân quyền xem dữ liệu
        if not user.is_company_admin and not user.is_superuser and not user.has_perm_code("sales.view_all"):
            managed_deps = user.managed_departments.all()
            if managed_deps.exists():
                from django.db.models import Q
                qs = qs.filter(
                    Q(created_by=user) | 
                    Q(created_by__department__in=managed_deps)
                )
            else:
                qs = qs.filter(created_by=user)
        # Filter theo trạng thái nếu có
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        return qs

    def check_object_permission(self, user, instance):
        if user.is_superuser or user.is_company_admin or user.has_perm_code("sales.view_all"):
            return True
        if instance.created_by == user:
            return True
        if instance.created_by and instance.created_by.department in user.managed_departments.all():
            return True
        return False

    def perform_update(self, serializer):
        if not self.check_object_permission(self.request.user, serializer.instance):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Bạn chỉ có quyền chỉnh sửa báo giá do mình tạo hoặc của nhân viên thuộc phòng ban do bạn quản lý.")
        serializer.save()

    def perform_destroy(self, instance):
        if not self.check_object_permission(self.request.user, instance):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Bạn chỉ có quyền xóa báo giá do mình tạo hoặc của nhân viên thuộc phòng ban do bạn quản lý.")
        if instance.status == Quotation.STATUS_ACCEPTED and not (self.request.user.is_superuser or self.request.user.is_company_admin):
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Không thể xóa báo giá đã được chấp nhận. Vui lòng liên hệ Admin.")
        instance.delete()

    def perform_create(self, serializer):
        from core.numbering import generate_quotation_number
        company = self.request.user.company
        quotation_number = generate_quotation_number(company)
        serializer.save(
            company=company,
            created_by=self.request.user,
            quotation_number=quotation_number,
        )

    @action(detail=True, methods=["post"], url_path="create-order")
    def create_order(self, request, pk=None):
        from django.db import transaction
        from core.numbering import generate_order_number
        from orders.models import Order, OrderItem
        from orders.serializers import OrderSerializer

        quotation = self.get_object()
        if quotation.status != Quotation.STATUS_ACCEPTED:
            return Response(
                {"detail": "Chỉ có thể tạo đơn hàng từ báo giá đã được chấp nhận."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            order_number = generate_order_number(quotation.company)
            order = Order.objects.create(
                company=quotation.company,
                order_number=order_number,
                customer=quotation.customer,
                quotation=quotation,
                created_by=request.user,
                installation_date=quotation.installation_date,
                notes=quotation.notes,
                discount_total=quotation.discount_total,
                total_amount=quotation.total_amount,
                status=Order.STATUS_PENDING,
            )
            for item in quotation.items.all():
                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    product_name=item.product_name,
                    unit_price=item.unit_price,
                    width=item.width,
                    height=item.height,
                    quantity=item.quantity,
                    discount_percent=item.discount_percent,
                )

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QuotationItemViewSet(viewsets.ModelViewSet):
    """CRUD dòng sản phẩm trong báo giá — filter qua quotation.company."""

    queryset = QuotationItem.objects.select_related(
        "quotation__company", "product"
    ).order_by("quotation", "id")
    serializer_class = QuotationItemSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": ["sales.view", "sales.create", "sales.edit"],
        "retrieve": ["sales.view", "sales.create", "sales.edit"],
        "create": ["sales.create", "sales.edit"],
        "update": ["sales.create", "sales.edit"],
        "partial_update": ["sales.create", "sales.edit"],
        "destroy": ["sales.create", "sales.edit"],
    }

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser and user.company_id is None:
            return super().get_queryset()
        return self.queryset.filter(quotation__company=user.company)


class QuotationTemplateViewSet(viewsets.ModelViewSet):
    """
    CRUD Mẫu báo giá:
    - Superadmin: Toàn quyền Thêm, Sửa, Xóa.
    - Company Admin & Nhân viên: Chỉ đọc các mẫu đang hoạt động (is_active=True).
    """

    queryset = QuotationTemplate.objects.all().order_by("-is_default", "name")
    serializer_class = QuotationTemplateSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve", "active_templates", "my_company_template"]:
            return [permissions.IsAuthenticated()]
        from users.permissions import IsSuperAdmin
        return [permissions.IsAuthenticated(), IsSuperAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_superuser:
            qs = qs.filter(is_active=True)
        return qs

    @action(detail=False, methods=["get"], url_path="active")
    def active_templates(self, request):
        qs = QuotationTemplate.objects.filter(is_active=True).order_by("-is_default", "name")
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="my-company-template")
    def my_company_template(self, request):
        company = request.user.company
        template = None
        if company and company.quotation_template and company.quotation_template.is_active:
            template = company.quotation_template
        if not template:
            template = QuotationTemplate.objects.filter(is_default=True, is_active=True).first()
        if not template:
            template = QuotationTemplate.objects.filter(is_active=True).first()
        if not template:
            return Response({"detail": "Chưa có mẫu báo giá nào."}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(template)
        return Response(serializer.data)

