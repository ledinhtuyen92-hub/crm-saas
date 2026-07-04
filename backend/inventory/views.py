from rest_framework import permissions, viewsets

from users.views import TenantQuerySetMixin

from .models import InventoryTransaction, Product, ProductCategory, StockLevel, Warehouse
from .serializers import (
    InventoryTransactionSerializer,
    ProductCategorySerializer,
    ProductSerializer,
    StockLevelSerializer,
    WarehouseSerializer,
)


class ProductCategoryViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD loại sản phẩm — cô lập theo company."""

    queryset = ProductCategory.objects.select_related("company").order_by("name")
    serializer_class = ProductCategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class ProductViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD sản phẩm — cô lập theo company."""

    queryset = Product.objects.select_related("company", "category").order_by("name")
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # Mặc định chỉ trả về sản phẩm đang hoạt động (trừ khi có ?include_inactive=true)
        if self.request.query_params.get("include_inactive") != "true":
            qs = qs.filter(is_active=True)
        # Tìm kiếm theo tên hoặc mã SKU
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(sku__icontains=search)
        # Filter theo category
        category_id = self.request.query_params.get("category_id")
        if category_id:
            qs = qs.filter(category_id=category_id)
        return qs


class WarehouseViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD kho hàng — cô lập theo company."""

    queryset = Warehouse.objects.select_related("company").order_by("name")
    serializer_class = WarehouseSerializer
    permission_classes = [permissions.IsAuthenticated]


class StockLevelViewSet(viewsets.ReadOnlyModelViewSet):
    """Xem tồn kho — filter qua product.company."""

    queryset = StockLevel.objects.select_related(
        "product__company", "warehouse"
    ).order_by("product__name", "warehouse__name")
    serializer_class = StockLevelSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser and user.company_id is None:
            return super().get_queryset()
        qs = self.queryset.filter(product__company=user.company)
        # Filter cảnh báo tồn kho thấp
        if self.request.query_params.get("low_stock") == "true":
            # Lọc thủ công vì is_low_stock là property
            low_stock_ids = [s.id for s in qs if s.is_low_stock]
            qs = qs.filter(id__in=low_stock_ids)
        warehouse_id = self.request.query_params.get("warehouse_id")
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        return qs


class InventoryTransactionViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """
    CRUD phiếu kho — cô lập theo company.
    Backend chặn cứng: type=export chỉ hợp lệ khi đơn hàng đã 'approved'.
    """

    queryset = InventoryTransaction.objects.select_related(
        "company", "product", "warehouse", "reference_order", "created_by"
    ).order_by("-created_at")
    serializer_class = InventoryTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter theo loại phiếu nếu có
        txn_type = self.request.query_params.get("type")
        if txn_type:
            qs = qs.filter(type=txn_type)
        return qs

    def perform_create(self, serializer):
        from core.numbering import generate_transaction_code
        from orders.models import Order

        company = self.request.user.company
        txn_type = serializer.validated_data.get("type")
        reference_order = serializer.validated_data.get("reference_order")

        # ─── SECURITY GATE: chặn cứng xuất kho khi đơn chưa duyệt ───
        if txn_type == "export" and reference_order:
            if reference_order.status != Order.STATUS_APPROVED:
                from rest_framework import serializers as drf_serializers
                raise drf_serializers.ValidationError(
                    {"reference_order": "Đơn hàng chưa ở trạng thái 'Đã chấp thuận', không thể xuất kho."}
                )

        # Sinh mã phiếu tự động
        transaction_code = generate_transaction_code(company, txn_type)
        serializer.save(
            company=company,
            created_by=self.request.user,
            transaction_code=transaction_code,
        )
