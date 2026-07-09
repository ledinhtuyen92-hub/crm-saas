from rest_framework import permissions, viewsets

from users.views import TenantQuerySetMixin
from users.permissions import ActionBasedPermission

from .models import ProductionOrder, ProductionStep
from .serializers import ProductionOrderSerializer, ProductionStepSerializer


class ProductionOrderViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """Lệnh sản xuất — cô lập theo company."""
    module_code = "production"

    queryset = ProductionOrder.objects.select_related(
        "company", "order__customer"
    ).prefetch_related("steps").order_by("-created_at")
    serializer_class = ProductionOrderSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": "production.view",
        "retrieve": "production.view",
        "create": "production.create",
        "update": "production.edit",
        "partial_update": "production.edit",
        "destroy": "production.delete",
    }

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter theo trạng thái nếu có
        prod_status = self.request.query_params.get("status")
        if prod_status:
            qs = qs.filter(status=prod_status)
        return qs

    def perform_create(self, serializer):
        company = self.request.user.company
        serializer.save(company=company)


class ProductionStepViewSet(viewsets.ModelViewSet):
    """Công đoạn sản xuất — filter qua production_order.company."""
    module_code = "production"

    queryset = ProductionStep.objects.select_related(
        "production_order__company", "assigned_to"
    ).order_by("production_order", "sequence")
    serializer_class = ProductionStepSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": "production.view",
        "retrieve": "production.view",
        "create": "production.edit", # step creation requires edit prod order permission
        "update": "production.edit",
        "partial_update": "production.edit",
        "destroy": "production.edit",
    }

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser and user.company_id is None:
            return super().get_queryset()
        qs = self.queryset.filter(production_order__company=user.company)
        # Filter theo production_order nếu có
        production_order_id = self.request.query_params.get("production_order_id")
        if production_order_id:
            qs = qs.filter(production_order_id=production_order_id)
        # Nhân viên chỉ xem công đoạn được phân công cho mình
        if not user.is_company_admin and not user.is_superuser:
            if not user.has_perm_code("production.view"):
                qs = qs.filter(assigned_to=user)
        return qs
