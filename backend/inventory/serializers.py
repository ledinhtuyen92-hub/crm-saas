from rest_framework import serializers

from .models import (
    InventoryTransaction, Product, ProductCategory, StockLevel, Warehouse,
    ProductTemplate, ProductAttribute, ProductAttributeValue
)
from sales.serializers import get_company_info_dict


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ["id", "company", "name", "description"]
        read_only_fields = ["id", "company"]


class ProductAttributeValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAttributeValue
        fields = ["id", "attribute", "value"]


class ProductAttributeSerializer(serializers.ModelSerializer):
    values = ProductAttributeValueSerializer(many=True, read_only=True)

    class Meta:
        model = ProductAttribute
        fields = ["id", "company", "name", "values"]
        read_only_fields = ["id", "company"]


class ProductTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductTemplate
        fields = ["id", "company", "name", "description", "category", "created_at", "updated_at"]
        read_only_fields = ["id", "company", "created_at", "updated_at"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    template_name = serializers.CharField(source="template.name", read_only=True)
    unit_display = serializers.CharField(source="get_unit_display", read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "company",
            "template",
            "template_name",
            "category",
            "category_name",
            "sku",
            "name",
            "description",
            "attributes",
            "unit",
            "unit_display",
            "price",
            "cost_price",
            "image",
            "image_url",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "category_name", "template_name", "unit_display", "image_url", "created_at", "updated_at"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image:
            try:
                return request.build_absolute_uri(obj.image.url) if request else obj.image.url
            except Exception:
                return obj.image.url
        return None


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
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    company_info = serializers.SerializerMethodField()

    class Meta:
        model = InventoryTransaction
        fields = [
            "id",
            "company",
            "transaction_code",
            "type",
            "type_display",
            "status",
            "status_display",
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
            "company_info",
        ]
        read_only_fields = [
            "id", "company", "transaction_code", "type_display", "status_display", "product_name", "product_sku",
            "warehouse_name", "created_by", "created_by_name", "created_at", "company_info",
        ]

    def get_company_info(self, obj):
        return get_company_info_dict(self, obj)
