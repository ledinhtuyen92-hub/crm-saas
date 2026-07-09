from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from users.views import TenantQuerySetMixin
from users.permissions import ActionBasedPermission
from .models import OrderPaymentMilestone, PaymentReceipt
from .serializers import OrderPaymentMilestoneSerializer, PaymentReceiptSerializer
from django.utils import timezone


from core.numbering import generate_receipt_code


class OrderPaymentMilestoneViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = OrderPaymentMilestone.objects.select_related("order", "company").prefetch_related("receipts").order_by("id")
    serializer_class = OrderPaymentMilestoneSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        order_id = self.request.query_params.get("order_id")
        if order_id:
            qs = qs.filter(order_id=order_id)
        return qs


class PaymentReceiptViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = PaymentReceipt.objects.select_related("order", "milestone", "created_by").order_by("-payment_date", "-created_at")
    serializer_class = PaymentReceiptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        order_id = self.request.query_params.get("order_id")
        if order_id:
            qs = qs.filter(order_id=order_id)
        return qs

    def perform_create(self, serializer):
        company = self.request.user.company
        code = generate_receipt_code(company)
        serializer.save(
            company=company,
            receipt_code=code,
            created_by=self.request.user,
        )
