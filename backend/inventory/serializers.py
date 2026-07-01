from rest_framework import serializers

from .models import (
    Inventory,
    InventoryTransaction,
    Product,
    ProductCategory,
    Warehouse,
)


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = [
            "id",
            "name",
        ]
        read_only_fields = ["id"]


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "sku",
            "category",
            "description",
            "price",
        ]
        read_only_fields = ["id"]


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = [
            "id",
            "name",
            "location",
        ]
        read_only_fields = ["id"]


class InventorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Inventory
        fields = [
            "id",
            "product",
            "warehouse",
            "quantity",
        ]
        read_only_fields = ["id"]


class InventoryTransactionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = InventoryTransaction
        fields = [
            "id",
            "product",
            "warehouse",
            "type",
            "type_display",
            "quantity",
            "reference_id",
            "created_at",
        ]
        read_only_fields = ["id", "type_display", "created_at"]
