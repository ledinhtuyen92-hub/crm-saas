from rest_framework import serializers

from .models import InventoryTransaction, Product, ProductCategory, StockLevel, Warehouse


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ["id", "company", "name", "description"]
        read_only_fields = ["id", "company"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    unit_display = serializers.CharField(source="get_unit_display", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "company",
            "category",
            "category_name",
            "sku",
            "name",
            "description",
            "unit",
            "unit_display",
            "price",
            "cost_price",
            "image",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "category_name", "unit_display", "created_at", "updated_at"]


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ["id", "company", "name", "location", "is_active"]
        read_only_fields = ["id", "company"]


class StockLevelSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = StockLevel
        fields = [
            "id",
            "product",
            "product_name",
            "product_sku",
            "warehouse",
            "warehouse_name",
            "quantity",
            "min_quantity",
            "is_low_stock",
        ]
        read_only_fields = [
            "id", "product_name", "product_sku",
            "warehouse_name", "is_low_stock",
        ]


class InventoryTransactionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)

    class Meta:
        model = InventoryTransaction
        fields = [
            "id",
            "company",
            "transaction_code",
            "type",
            "type_display",
            "product",
            "product_name",
            "product_sku",
            "warehouse",
            "warehouse_name",
            "quantity",
            "unit_cost",
            "reference_order",
            "note",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id", "company", "type_display", "product_name", "product_sku",
            "warehouse_name", "created_by_name", "created_at",
        ]
