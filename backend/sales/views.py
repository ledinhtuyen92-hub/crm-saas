from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from users.views import TenantQuerySetMixin
from users.permissions import ActionBasedPermission

from .models import Quotation, QuotationItem
from .serializers import QuotationItemSerializer, QuotationSerializer


class QuotationViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD báo giá — cô lập theo company."""

    queryset = Quotation.objects.select_related(
        "company", "customer", "created_by"
    ).prefetch_related("items").order_by("-created_at")
    serializer_class = QuotationSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": "sales.view",
        "retrieve": "sales.view",
        "create": "sales.create",
        "update": "sales.edit",
        "partial_update": "sales.edit",
        "destroy": "sales.delete",
        "create_order": "sales.view", # To create order, user must at least view it
    }

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Phân quyền xem dữ liệu
        if not user.is_company_admin and not user.is_superuser and not user.has_perm_code("sales.view"):
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
        "list": "sales.view",
        "retrieve": "sales.view",
        "create": "sales.edit", # Creating item requires edit quotation permission
        "update": "sales.edit",
        "partial_update": "sales.edit",
        "destroy": "sales.edit",
    }

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser and user.company_id is None:
            return super().get_queryset()
        return self.queryset.filter(quotation__company=user.company)
