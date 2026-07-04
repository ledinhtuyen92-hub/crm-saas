from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.views import TenantQuerySetMixin

from .models import Order, OrderItem
from .serializers import OrderItemSerializer, OrderSerializer


class OrderViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """
    CRUD đơn hàng — cô lập theo company.
    Action đặc biệt: POST /orders/{id}/approve/ — duyệt đơn hàng.
    Backend chặn cứng: chỉ user có quyền orders.approve mới duyệt được.
    """

    queryset = Order.objects.select_related(
        "company", "customer", "quotation", "created_by", "approved_by"
    ).prefetch_related("items").order_by("-created_at")
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Nhân viên Sale chỉ xem đơn do mình tạo (trừ khi có quyền orders.view_all)
        if not user.is_company_admin and not user.is_superuser:
            if not user.has_perm_code("orders.view_all"):
                qs = qs.filter(created_by=user)
        # Filter theo trạng thái
        order_status = self.request.query_params.get("status")
        if order_status:
            qs = qs.filter(status=order_status)
        return qs

    def perform_create(self, serializer):
        from core.numbering import generate_order_number
        company = self.request.user.company
        order_number = generate_order_number(company)
        serializer.save(
            company=company,
            created_by=self.request.user,
            order_number=order_number,
            status="pending",
        )

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """
        POST /api/orders/{id}/approve/
        Duyệt đơn hàng — chỉ user có quyền orders.approve.
        Tự động trigger xuất kho sau khi duyệt.
        """
        order = self.get_object()

        # Kiểm tra quyền approve
        if not request.user.is_company_admin and not request.user.has_perm_code("orders.approve"):
            return Response(
                {"detail": "Bạn không có quyền duyệt đơn hàng."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            order.approve(approved_by_user=request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            OrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        """POST /api/orders/{id}/reject/ — Từ chối đơn hàng."""
        order = self.get_object()

        if not request.user.is_company_admin and not request.user.has_perm_code("orders.approve"):
            return Response(
                {"detail": "Bạn không có quyền từ chối đơn hàng."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if order.status != Order.STATUS_PENDING:
            return Response(
                {"detail": "Chỉ có thể từ chối đơn đang ở trạng thái 'Chờ duyệt'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = Order.STATUS_REJECTED
        order.approved_by = request.user
        order.save(update_fields=["status", "approved_by", "updated_at"])
        return Response(
            OrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class OrderItemViewSet(viewsets.ModelViewSet):
    """CRUD dòng sản phẩm trong đơn hàng — filter qua order.company."""

    queryset = OrderItem.objects.select_related(
        "order__company", "product"
    ).order_by("order", "id")
    serializer_class = OrderItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser and user.company_id is None:
            return super().get_queryset()
        return self.queryset.filter(order__company=user.company)
