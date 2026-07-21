from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from users.models import User

from users.views import TenantQuerySetMixin
from users.permissions import ActionBasedPermission

from .models import DeliveryOrder, WarrantyCard
from .serializers import DeliveryOrderSerializer, WarrantyCardSerializer


class DeliveryOrderViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """Quản lý Lệnh giao hàng."""
    module_code = "delivery"

    queryset = DeliveryOrder.objects.select_related(
        "company", "order__customer"
    ).order_by("-created_at")
    serializer_class = DeliveryOrderSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": "delivery.view",
        "retrieve": "delivery.view",
        "create": "delivery.edit",
        "update": "delivery.edit",
        "partial_update": "delivery.edit",
        "destroy": "delivery.delete",
        "assign_shipper": "delivery.assign",
    }

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        search_query = self.request.query_params.get("search")
        
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        if search_query:
            from django.db.models import Q
            qs = qs.filter(
                Q(delivery_code__icontains=search_query) |
                Q(order__order_number__icontains=search_query) |
                Q(order__customer__name__icontains=search_query) |
                Q(order__customer__phone__icontains=search_query) |
                Q(shipper_name__icontains=search_query) |
                Q(shipper_phone__icontains=search_query)
            )
        return qs

    def perform_create(self, serializer):
        company = self.request.user.company
        instance = serializer.save(company=company)
        if not instance.delivery_code and instance.order:
            from core.numbering import derive_code_from_order
            instance.delivery_code = derive_code_from_order(instance.order.order_number, company, "gh")
            instance.save(update_fields=["delivery_code"])

    def perform_update(self, serializer):
        instance = self.get_object()
        new_status = serializer.validated_data.get("status", instance.status)
        if new_status != instance.status and hasattr(instance.order, 'warranty_card'):
            warranty = instance.order.warranty_card
            if warranty.status == "active" and new_status != "delivered":
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"status": "Không thể lùi trạng thái khi Đơn hàng đã có Phiếu bảo hành đang hiệu lực."})
        serializer.save()

    @action(detail=True, methods=["post"])
    def assign_shipper(self, request, pk=None):
        delivery = self.get_object()
        shipper_id = request.data.get("shipper_user_id")
        
        if not shipper_id:
            return Response({"detail": "Vui lòng chọn nhân viên."}, status=status.HTTP_400_BAD_REQUEST)
            
        shipper = get_object_or_404(User, id=shipper_id, company=request.user.company)
        
        delivery.shipper_user = shipper
        delivery.shipper_name = shipper.full_name
        delivery.shipper_phone = shipper.phone
        delivery.save(update_fields=["shipper_user", "shipper_name", "shipper_phone"])
        
        serializer = self.get_serializer(delivery)
        return Response(serializer.data)


class WarrantyCardViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """Quản lý Phiếu bảo hành."""
    module_code = "warranty"

    queryset = WarrantyCard.objects.select_related(
        "company", "order", "customer"
    ).order_by("-created_at")
    serializer_class = WarrantyCardSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": "warranty.view",
        "retrieve": "warranty.view",
        "create": "warranty.edit",
        "update": "warranty.edit",
        "partial_update": "warranty.edit",
        "destroy": "warranty.delete",
    }

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        search_query = self.request.query_params.get("search")
        
        if status_filter:
            from django.utils import timezone
            today = timezone.now().date()
            if status_filter == "expired":
                qs = qs.filter(status="active", end_date__lt=today)
            elif status_filter == "active":
                # Active must not be expired
                from django.db.models import Q
                qs = qs.filter(Q(status="active") & (Q(end_date__gte=today) | Q(end_date__isnull=True)))
            else:
                qs = qs.filter(status=status_filter)
                
        if search_query:
            from django.db.models import Q
            qs = qs.filter(
                Q(warranty_code__icontains=search_query) |
                Q(order__order_number__icontains=search_query) |
                Q(customer__name__icontains=search_query) |
                Q(customer__phone__icontains=search_query)
            )
        return qs

    def perform_create(self, serializer):
        company = self.request.user.company
        instance = serializer.save(company=company)
        if not instance.warranty_code:
            from core.numbering import generate_warranty_code
            instance.warranty_code = generate_warranty_code(company)
            instance.save(update_fields=["warranty_code"])
