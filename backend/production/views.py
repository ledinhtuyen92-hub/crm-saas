from rest_framework import permissions, viewsets

from users.views import TenantQuerySetMixin
from users.permissions import ActionBasedPermission

from .models import Factory, ProductionOrder, ProductionStep
from .serializers import FactorySerializer, ProductionOrderSerializer, ProductionStepSerializer
from rest_framework.decorators import action
from rest_framework.response import Response
from orders.serializers import OrderSerializer
from inventory.serializers import InventoryTransactionSerializer


class FactoryViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """Quản lý danh sách nhà máy — cô lập theo company."""
    module_code = "production"

    queryset = Factory.objects.select_related("company", "linked_warehouse").order_by("name")
    serializer_class = FactorySerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]

    action_permissions = {
        "list": ["production.view", "inventory.approve_export", "production.manage_factory"],
        "retrieve": ["production.view", "inventory.approve_export", "production.manage_factory"],
        "create": "production.manage_factory",
        "update": "production.manage_factory",
        "partial_update": "production.manage_factory",
        "destroy": "production.manage_factory",
    }

    def perform_create(self, serializer):
        company = self.request.user.company
        serializer.save(company=company)



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
        "order_details": "production.view",
        "export_details": "production.view",
    }

    @action(detail=True, methods=['get'])
    def order_details(self, request, pk=None):
        instance = self.get_object()
        if not instance.order:
            from rest_framework.exceptions import NotFound
            raise NotFound("Không tìm thấy đơn hàng liên kết.")
        # Return order details bypass standard view permissions
        serializer = OrderSerializer(instance.order, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def export_details(self, request, pk=None):
        instance = self.get_object()
        if not instance.order:
            from rest_framework.exceptions import NotFound
            raise NotFound("Không tìm thấy đơn hàng liên kết.")
            
        from inventory.models import InventoryTransaction
        txn = InventoryTransaction.objects.filter(
            reference_order=instance.order, 
            type=InventoryTransaction.TYPE_EXPORT
        ).order_by('-created_at').first()
        
        if not txn:
            from rest_framework.exceptions import NotFound
            raise NotFound("Không tìm thấy phiếu xuất kho liên kết.")
            
        # Return export details bypass standard view permissions
        serializer = InventoryTransactionSerializer(txn, context={'request': request})
        return Response(serializer.data)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        # Scope filtering
        is_admin = user.is_company_admin or user.is_superuser
        can_scope_company = is_admin or user.has_perm_code("production.scope_company")
        can_scope_my_factory = is_admin or user.has_perm_code("production.scope_my_factory")

        if not can_scope_company:
            from django.db.models import Q
            # Personal scope base: sales reps who created the order, or workers assigned to a step
            personal_q = Q(order__created_by=user) | Q(steps__assigned_to=user)
            
            if can_scope_my_factory and user.department_id and user.department.factory_id:
                # Factory scope + Personal scope
                qs = qs.filter(Q(factory_id=user.department.factory_id) | personal_q).distinct()
            else:
                # Only Personal scope
                qs = qs.filter(personal_q).distinct()

        # Filter theo trạng thái nếu có
        prod_status = self.request.query_params.get("status")
        if prod_status:
            if prod_status == "undelivered":
                qs = qs.filter(status="completed", order__delivery_order__isnull=True)
            else:
                qs = qs.filter(status=prod_status)
        return qs

    def perform_create(self, serializer):
        company = self.request.user.company
        serializer.save(company=company)

    def perform_update(self, serializer):
        instance = self.get_object()
        new_status = serializer.validated_data.get("status", instance.status)
        if new_status != instance.status and hasattr(instance.order, 'delivery_order'):
            delivery = instance.order.delivery_order
            if delivery.status == "delivered":
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"status": "Không thể thay đổi trạng thái khi Đơn giao hàng đã giao thành công."})
        serializer.save()


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
        "create": ["production.edit", "production.update_step"], # Allow step creation if they have edit prod or update step
        "update": ["production.edit", "production.update_step"],
        "partial_update": ["production.edit", "production.update_step"],
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
