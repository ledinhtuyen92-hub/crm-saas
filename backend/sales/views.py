from rest_framework import permissions, viewsets

from users.views import TenantQuerySetMixin

from .models import Quotation, QuotationItem
from .serializers import QuotationItemSerializer, QuotationSerializer


class QuotationViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD báo giá — cô lập theo company."""

    queryset = Quotation.objects.select_related(
        "company", "customer", "created_by"
    ).prefetch_related("items").order_by("-created_at")
    serializer_class = QuotationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Nhân viên Sale chỉ xem báo giá do mình tạo (trừ khi có quyền orders.view_all)
        if not user.is_company_admin and not user.is_superuser:
            if not user.has_perm_code("sales.view"):
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


class QuotationItemViewSet(viewsets.ModelViewSet):
    """CRUD dòng sản phẩm trong báo giá — filter qua quotation.company."""

    queryset = QuotationItem.objects.select_related(
        "quotation__company", "product"
    ).order_by("quotation", "id")
    serializer_class = QuotationItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser and user.company_id is None:
            return super().get_queryset()
        return self.queryset.filter(quotation__company=user.company)
