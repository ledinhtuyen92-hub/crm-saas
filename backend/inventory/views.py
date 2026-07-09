from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from users.views import TenantQuerySetMixin
from users.permissions import ActionBasedPermission

from .models import (
    InventoryTransaction, Product, ProductCategory, StockLevel, Warehouse,
    ProductTemplate, ProductAttribute, ProductAttributeValue
)
from .serializers import (
    InventoryTransactionSerializer,
    ProductCategorySerializer,
    ProductSerializer,
    StockLevelSerializer,
    WarehouseSerializer,
    ProductTemplateSerializer,
    ProductAttributeSerializer,
    ProductAttributeValueSerializer,
)


class ProductCategoryViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD loại sản phẩm — cô lập theo company."""
    module_code = "inventory"

    queryset = ProductCategory.objects.select_related("company").order_by("name")
    serializer_class = ProductCategorySerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": "products.manage_categories",
        "retrieve": "products.manage_categories",
        "create": "products.manage_categories",
        "update": "products.manage_categories",
        "partial_update": "products.manage_categories",
        "destroy": "products.manage_categories",
    }


class ProductTemplateViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD Mẫu sản phẩm."""
    module_code = "inventory"
    queryset = ProductTemplate.objects.select_related("company", "category").order_by("name")
    serializer_class = ProductTemplateSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": ["products.view", "sales.view"],
        "retrieve": ["products.view", "sales.view"],
        "create": "products.create",
        "update": "products.edit",
        "partial_update": "products.edit",
        "destroy": "products.delete",
        "generate_variants": "products.create",
    }

    @action(detail=True, methods=['post'])
    def generate_variants(self, request, pk=None):
        template = self.get_object()
        attributes_data = request.data.get("attributes", [])
        # attributes_data format: [{"name": "Màu sắc", "values": ["Đỏ", "Xanh"]}, {"name": "Size", "values": ["M", "L"]}]
        
        if not attributes_data:
            # Generate 1 default variant
            Product.objects.get_or_create(
                company=template.company,
                template=template,
                sku=f"{template.id}-DEFAULT",
                defaults={
                    "name": template.name,
                    "category": template.category,
                    "price": 0,
                    "cost_price": 0,
                }
            )
            return Response({"detail": "Đã tạo 1 biến thể mặc định."})
        
        import itertools
        
        # Build list of value lists
        keys = []
        value_lists = []
        for attr in attributes_data:
            keys.append(attr["name"])
            value_lists.append(attr["values"])
            
        combinations = list(itertools.product(*value_lists))
        
        created_count = 0
        for combo in combinations:
            attr_dict = dict(zip(keys, combo))
            
            # sku like TEMPLATEID-DO-M
            sku_suffix = "-".join([str(v).upper() for v in combo])
            sku = f"{template.id}-{sku_suffix}"
            variant_name = f"{template.name} ({', '.join(combo)})"
            
            # Check if variant exists
            if not Product.objects.filter(company=template.company, template=template, attributes=attr_dict).exists():
                Product.objects.create(
                    company=template.company,
                    template=template,
                    sku=sku,
                    name=variant_name,
                    category=template.category,
                    attributes=attr_dict,
                    price=0,
                    cost_price=0,
                )
                created_count += 1
                
        return Response({"detail": f"Đã sinh {created_count} biến thể mới."})


class ProductAttributeViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD Thuộc tính sản phẩm."""
    module_code = "inventory"
    queryset = ProductAttribute.objects.select_related("company").prefetch_related("values").order_by("name")
    serializer_class = ProductAttributeSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": ["products.view", "sales.view"],
        "retrieve": ["products.view", "sales.view"],
        "create": "products.create",
        "update": "products.edit",
        "partial_update": "products.edit",
        "destroy": "products.delete",
    }


class ProductAttributeValueViewSet(viewsets.ModelViewSet):
    """CRUD Giá trị thuộc tính sản phẩm. Không kế thừa TenantQuerySetMixin vì nó query theo attribute."""
    queryset = ProductAttributeValue.objects.select_related("attribute").order_by("value")
    serializer_class = ProductAttributeValueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        attribute_id = self.request.query_params.get("attribute_id")
        if attribute_id:
            qs = qs.filter(attribute_id=attribute_id)
        return qs


class ProductViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """CRUD sản phẩm — cô lập theo company."""
    module_code = "inventory"

    queryset = Product.objects.select_related("company", "category").order_by("name")
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": ["products.view", "sales.view", "sales.create", "orders.view", "orders.create", "crm.view"],
        "retrieve": ["products.view", "sales.view", "sales.create", "orders.view", "orders.create", "crm.view"],
        "create": "products.create",
        "update": "products.edit",
        "partial_update": "products.edit",
        "destroy": "products.delete",
    }

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
    module_code = "inventory"

    queryset = Warehouse.objects.select_related("company").order_by("name")
    serializer_class = WarehouseSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": "inventory.manage_warehouse",
        "retrieve": "inventory.manage_warehouse",
        "create": "inventory.manage_warehouse",
        "update": "inventory.manage_warehouse",
        "partial_update": "inventory.manage_warehouse",
        "destroy": "inventory.manage_warehouse",
    }

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        stocks_with_items = StockLevel.objects.filter(warehouse=instance, quantity__gt=0)
        has_txns = InventoryTransaction.objects.filter(warehouse=instance).exists()

        if stocks_with_items.exists() or has_txns:
            target_id = request.query_params.get("target_warehouse_id") or request.data.get("target_warehouse_id")
            if not target_id:
                return Response(
                    {
                        "has_stock": True,
                        "detail": f"Kho hàng '{instance.name}' đang có sản phẩm tồn kho hoặc lịch sử giao dịch. Vui lòng chọn kho nhận để chuyển toàn bộ dữ liệu sang trước khi xoá."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            target_warehouse = Warehouse.objects.filter(company=instance.company, id=target_id).first()
            if not target_warehouse or target_warehouse.id == instance.id:
                return Response(
                    {"detail": "Kho nhận sản phẩm không hợp lệ hoặc trùng với kho đang xoá."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                from core.numbering import generate_transaction_code
                for stock in stocks_with_items:
                    target_stock, _ = StockLevel.objects.select_for_update().get_or_create(
                        product=stock.product,
                        warehouse=target_warehouse,
                        defaults={"quantity": 0}
                    )
                    target_stock.quantity += stock.quantity
                    target_stock.save(update_fields=["quantity"])

                    code = generate_transaction_code(instance.company, "adjust")
                    InventoryTransaction.objects.create(
                        company=instance.company,
                        transaction_code=code,
                        product=stock.product,
                        warehouse=target_warehouse,
                        type="adjust",
                        quantity=stock.quantity,
                        note=f"Chuyển tồn kho tự động từ kho đã xoá ({instance.name}) sang ({target_warehouse.name})",
                        created_by=request.user
                    )
                StockLevel.objects.filter(warehouse=instance).delete()
                InventoryTransaction.objects.filter(warehouse=instance).update(warehouse=target_warehouse)
                instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        StockLevel.objects.filter(warehouse=instance).delete()
        return super().destroy(request, *args, **kwargs)


class StockLevelViewSet(viewsets.ReadOnlyModelViewSet):
    """Xem tồn kho — filter qua product.company."""
    module_code = "inventory"

    queryset = StockLevel.objects.select_related(
        "product__company", "warehouse"
    ).order_by("product__name", "warehouse__name")
    serializer_class = StockLevelSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": "inventory.view",
        "retrieve": "inventory.view",
    }

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
    module_code = "inventory"

    queryset = InventoryTransaction.objects.select_related(
        "company", "product", "warehouse", "reference_order", "created_by"
    ).order_by("-created_at")
    serializer_class = InventoryTransactionSerializer
    permission_classes = [permissions.IsAuthenticated, ActionBasedPermission]
    
    action_permissions = {
        "list": "inventory.view",
        "retrieve": "inventory.view",
        "create": "inventory.import", # We'll need a way to distinguish adjust/export, but import is default creation. Wait, we can let logic inside perform_create handle finer-grained permission if needed, but for now inventory.import covers transactions generally.
        "update": "inventory.adjust", # Actually transaction cannot be updated usually, but let's map it
        "partial_update": "inventory.adjust",
    }

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter theo loại phiếu nếu có
        txn_type = self.request.query_params.get("type")
        if txn_type:
            qs = qs.filter(type=txn_type)
        return qs

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Xoá từng giao dịch kho không được phép theo chuẩn ERP. Xin vui lòng tạo Phiếu Điều Chỉnh để bù trừ sai lệch tồn kho."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    @transaction.atomic
    def perform_create(self, serializer):
        from core.numbering import generate_transaction_code
        from orders.models import Order
        from .models import StockLevel

        company = self.request.user.company
        txn_type = serializer.validated_data.get("type")
        reference_order = serializer.validated_data.get("reference_order")
        product = serializer.validated_data.get("product")
        warehouse = serializer.validated_data.get("warehouse")
        quantity = serializer.validated_data.get("quantity", 0)

        # ─── SECURITY GATE: chặn cứng xuất kho khi đơn chưa duyệt hoặc chưa qua DO Gate ───
        if txn_type == "export" and reference_order:
            if reference_order.status != Order.STATUS_APPROVED:
                from rest_framework import serializers as drf_serializers
                raise drf_serializers.ValidationError(
                    {"reference_order": "Đơn hàng chưa ở trạng thái 'Đã chấp thuận', không thể xuất kho."}
                )
            allowed_fin_statuses = [Order.FIN_STATUS_FULLY_PAID, Order.FIN_STATUS_CREDIT_APPROVED]
            if reference_order.financial_status not in allowed_fin_statuses:
                from rest_framework import serializers as drf_serializers
                raise drf_serializers.ValidationError(
                    {"reference_order": f"Khóa Xuất Kho (DO Gate): Đơn {reference_order.order_number} chưa thanh toán đủ hoặc chưa được phê duyệt xuất kho nợ."}
                )

        # Sinh mã phiếu tự động
        transaction_code = generate_transaction_code(company, txn_type)
        serializer.save(
            company=company,
            created_by=self.request.user,
            transaction_code=transaction_code,
        )

        # ─── Cập nhật tồn kho (StockLevel) ───
        if warehouse and product:
            stock, _ = StockLevel.objects.select_for_update().get_or_create(
                product=product,
                warehouse=warehouse,
                defaults={"quantity": 0},
            )
            if txn_type == "import":
                stock.quantity += quantity
                stock.save(update_fields=["quantity"])
            elif txn_type == "adjust":
                stock.quantity = quantity
                stock.save(update_fields=["quantity"])
            elif txn_type == "export" and not reference_order:
                stock.quantity = max(0, stock.quantity - quantity)
                stock.save(update_fields=["quantity"])

    @action(detail=False, methods=["delete"], url_path="clear-history")
    def clear_history(self, request):
        if not request.user.is_company_admin and not request.user.is_superuser:
            return Response(
                {"detail": "Chỉ Admin công ty mới có quyền xóa toàn bộ lịch sử giao dịch kho."},
                status=status.HTTP_403_FORBIDDEN
            )
        count, _ = self.get_queryset().delete()
        return Response({"detail": f"Đã xóa {count} giao dịch kho thành công."})
