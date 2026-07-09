from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.views import TenantQuerySetMixin
from users.permissions import ActionBasedPermission

from .models import Order, OrderItem
from .serializers import OrderItemSerializer, OrderSerializer


class OrderViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """
    CRUD đơn hàng — cô lập theo company.
    Action đặc biệt: POST /orders/{id}/approve/ — duyệt đơn hàng.
    Backend chặn cứng: chỉ user có quyền orders.approve mới duyệt được.
    """
    module_code = "orders"

    queryset = Order.objects.select_related(
        "company", "customer", "quotation", "created_by", "approved_by"
    ).prefetch_related("items").order_by("-created_at")
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": "orders.view",
        "retrieve": "orders.view",
        "create": "orders.create",
        "update": "orders.edit",
        "partial_update": "orders.edit",
        "destroy": "orders.delete",
        "approve": "orders.approve",
        "reject": "orders.approve",
    }

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Phân quyền xem dữ liệu
        if not user.is_company_admin and not user.is_superuser and not user.has_perm_code("orders.view_all"):
            managed_deps = user.managed_departments.all()
            if managed_deps.exists():
                from django.db.models import Q
                qs = qs.filter(
                    Q(created_by=user) | 
                    Q(created_by__department__in=managed_deps)
                )
            else:
                qs = qs.filter(created_by=user)
        # Filter theo trạng thái
        order_status = self.request.query_params.get("status")
        if order_status:
            qs = qs.filter(status=order_status)
            
        # Tìm kiếm theo tên khách, SĐT khách, mã đơn hàng
        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(order_number__icontains=search) | 
                Q(customer__name__icontains=search) |
                Q(customer__phone__icontains=search)
            )
            
        return qs

    def perform_create(self, serializer):
        from core.numbering import generate_order_number
        company = self.request.user.company
        order_number = generate_order_number(company)
        order = serializer.save(
            company=company,
            created_by=self.request.user,
            order_number=order_number,
            status="pending",
        )
        try:
            from approvals.models import ApprovalRequest, ApprovalStep
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(order)
            req = ApprovalRequest.objects.create(
                company=company,
                content_type=ct,
                object_id=order.id,
                requester=self.request.user,
                title=f"Phê duyệt Đơn hàng {order.order_number}",
                description=f"Đơn hàng {order.order_number} — Khách hàng: {order.customer.name if order.customer else 'Khách lẻ'}",
                status=ApprovalRequest.STATUS_PENDING,
            )
            ApprovalStep.objects.create(
                request=req,
                step_order=1,
                status=ApprovalStep.STATUS_PENDING,
            )
        except Exception as e:
            import traceback
            with open("error_approval.txt", "w", encoding="utf-8") as f:
                f.write(traceback.format_exc())

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
            from approvals.models import ApprovalRequest, ApprovalStep
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(order)
            reqs = ApprovalRequest.objects.filter(content_type=ct, object_id=order.id)
            for req in reqs:
                req.status = ApprovalRequest.STATUS_APPROVED
                req.save(update_fields=["status"])
                req.steps.filter(status=ApprovalStep.STATUS_PENDING).update(status=ApprovalStep.STATUS_APPROVED, acted_by=request.user)
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
        try:
            from approvals.models import ApprovalRequest, ApprovalStep
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(order)
            reqs = ApprovalRequest.objects.filter(content_type=ct, object_id=order.id)
            for req in reqs:
                req.status = ApprovalRequest.STATUS_REJECTED
                req.save(update_fields=["status"])
                req.steps.filter(status=ApprovalStep.STATUS_PENDING).update(status=ApprovalStep.STATUS_REJECTED, acted_by=request.user)
        except Exception:
            pass
        return Response(
            OrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="request_credit_approval")
    def request_credit_approval(self, request, pk=None):
        """POST /api/orders/{id}/request_credit_approval/ — Trình duyệt xuất kho nợ cho đơn hàng."""
        order = self.get_object()
        if order.financial_status in [Order.FIN_STATUS_FULLY_PAID, Order.FIN_STATUS_CREDIT_APPROVED]:
            return Response(
                {"detail": "Đơn hàng này đã đủ điều kiện xuất kho, không cần trình duyệt nợ."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from approvals.models import ApprovalRequest, ApprovalStep
        from users.models import User

        # Tìm người duyệt là Giám đốc (is_company_admin hoặc role Giám đốc)
        approver = User.objects.filter(company=order.company, is_company_admin=True).first()
        if not approver:
            approver = User.objects.filter(company=order.company, is_superuser=True).first()

        req = ApprovalRequest.objects.create(
            company=order.company,
            title=f"Duyệt xuất kho nợ - {order.order_number}",
            description=f"Khách hàng {order.customer.name} còn nợ {order.remaining_debt:,.0f} đ. Trình duyệt xuất kho trước khi thu đủ tiền.",
            requester=request.user,
            content_object=order,
            status=ApprovalRequest.STATUS_PENDING,
        )

        ApprovalStep.objects.create(
            request=req,
            step_order=1,
            approver_user=approver,
            status=ApprovalStep.STATUS_PENDING,
        )

        return Response(
            {"detail": "Đã gửi yêu cầu trình duyệt xuất kho nợ tới Giám đốc!"},
            status=status.HTTP_201_CREATED,
        )

    def perform_destroy(self, instance):
        from production.models import ProductionOrder
        ProductionOrder.objects.filter(order=instance).delete()
        from inventory.models import InventoryTransaction
        InventoryTransaction.objects.filter(reference_order=instance).update(reference_order=None)
        try:
            from approvals.models import ApprovalRequest
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(instance)
            ApprovalRequest.objects.filter(content_type=ct, object_id=instance.id).delete()
        except Exception:
            pass
        instance.delete()


class OrderItemViewSet(viewsets.ModelViewSet):
    """CRUD dòng sản phẩm trong đơn hàng — filter qua order.company."""
    module_code = "orders"

    queryset = OrderItem.objects.select_related(
        "order__company", "product"
    ).order_by("order", "id")
    serializer_class = OrderItemSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": "orders.view",
        "retrieve": "orders.view",
        "create": "orders.edit", # Creating item requires edit order permission
        "update": "orders.edit",
        "partial_update": "orders.edit",
        "destroy": "orders.edit",
    }

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser and user.company_id is None:
            return super().get_queryset()
        return self.queryset.filter(order__company=user.company)
