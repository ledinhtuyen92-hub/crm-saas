from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    """
    GET /api/notifications/
    Trả về danh sách thông báo của user đang đăng nhập, filter theo company.
    """

    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Notification.objects.filter(
            company=user.company,
            recipient=user,
        ).select_related("sender").order_by("-created_at")

        # Lọc chỉ chưa đọc nếu có query param ?unread=true
        if self.request.query_params.get("unread") == "true":
            qs = qs.filter(is_read=False)
        return qs


class NotificationMarkReadView(generics.UpdateAPIView):
    """
    PATCH /api/notifications/<id>/read/
    Đánh dấu một thông báo là đã đọc.
    """

    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["patch"]

    def get_queryset(self):
        return Notification.objects.filter(
            company=self.request.user.company,
            recipient=self.request.user,
        )

    def patch(self, request, *args, **kwargs):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notification).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def mark_all_read(request):
    """
    POST /api/notifications/mark-all-read/
    Đánh dấu tất cả thông báo của user là đã đọc.
    """
    updated_count = Notification.objects.filter(
        company=request.user.company,
        recipient=request.user,
        is_read=False,
    ).update(is_read=True)
    return Response(
        {"detail": f"Đã đánh dấu {updated_count} thông báo là đã đọc."},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def unread_count(request):
    """
    GET /api/notifications/unread-count/
    Trả về số lượng thông báo chưa đọc — dùng cho Badge trên icon Chuông.
    """
    count = Notification.objects.filter(
        company=request.user.company,
        recipient=request.user,
        is_read=False,
    ).count()

    # Tính toán thêm số lượng badge cho menu
    pending_inventory_count = 0
    pending_approval_count = 0
    pending_sales_count = 0
    pending_orders_count = 0
    pending_production_count = 0
    pending_delivery_count = 0

    from inventory.models import InventoryTransaction
    from approvals.models import ApprovalStep
    
    # 1. Kho vận: đếm số lệnh xuất chờ duyệt
    if request.user.is_superuser or request.user.is_company_admin or (request.user.role and request.user.role.permissions.filter(code="inventory.approve_export").exists()):
        pending_inventory_count = InventoryTransaction.objects.filter(
            company=request.user.company,
            type=InventoryTransaction.TYPE_EXPORT,
            status=InventoryTransaction.STATUS_PENDING
        ).values('transaction_code').distinct().count()

    # 2. Phê duyệt (Tổng): đếm số yêu cầu đang chờ chính user này duyệt
    from approvals.models import ApprovalRequest
    from django.db.models import Q
    from django.contrib.contenttypes.models import ContentType

    qs = ApprovalRequest.objects.filter(company=request.user.company, status=ApprovalRequest.STATUS_PENDING)
    
    if not (request.user.is_superuser or request.user.is_company_admin):
        q_filter = Q(steps__approver_user=request.user)
        if request.user.role:
            q_filter |= Q(steps__approver_role=request.user.role)
            perms = request.user.role.permissions.values_list('code', flat=True)
            if 'orders.approve' in perms:
                from orders.models import Order
                q_filter |= Q(content_type=ContentType.objects.get_for_model(Order))
            if 'sales.approve' in perms:
                from sales.models import Quotation
                q_filter |= Q(content_type=ContentType.objects.get_for_model(Quotation))
            if 'approvals.approve' in perms:
                from orders.models import Order
                from sales.models import Quotation
                order_ct = ContentType.objects.get_for_model(Order)
                quote_ct = ContentType.objects.get_for_model(Quotation)
                q_filter |= ~Q(content_type__in=[order_ct, quote_ct])
        qs = qs.filter(q_filter).distinct()
    
    base_approval_qs = qs
    pending_approval_count = base_approval_qs.count()

    # Phê duyệt theo từng loại (Bán hàng, Đơn hàng)
    pending_sales_count = base_approval_qs.filter(content_type__model='quotation').count()
    pending_orders_count = base_approval_qs.filter(content_type__model='order').count()

    # 3. Sản xuất: đếm số lệnh chờ sản xuất
    if request.user.is_superuser or request.user.is_company_admin or (request.user.role and request.user.role.permissions.filter(code__in=["production.update_step", "production.manage_factory", "production.view"]).exists()):
        from production.models import ProductionOrder
        pending_production_count = ProductionOrder.objects.filter(
            company=request.user.company,
            status=ProductionOrder.STATUS_PENDING
        ).count()
        
    # 4. Giao hàng: đếm số lệnh chờ giao
    if request.user.is_superuser or request.user.is_company_admin or (request.user.role and request.user.role.permissions.filter(code__in=["delivery.assign", "delivery.edit", "delivery.view"]).exists()):
        from delivery.models import DeliveryOrder
        pending_delivery_count = DeliveryOrder.objects.filter(
            company=request.user.company,
            status=DeliveryOrder.STATUS_PENDING
        ).count()

    return Response({
        "unread_count": count,
        "pending_inventory_count": pending_inventory_count,
        "pending_approval_count": pending_approval_count,
        "pending_sales_count": pending_sales_count,
        "pending_orders_count": pending_orders_count,
        "pending_production_count": pending_production_count,
        "pending_delivery_count": pending_delivery_count,
    })
