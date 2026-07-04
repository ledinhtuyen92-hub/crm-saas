from rest_framework import serializers

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id",
            "order",
            "product",
            "product_name",
            "unit_price",
            "width",
            "height",
            "quantity",
            "discount_percent",
            "line_total",
        ]
        read_only_fields = ["id", "line_total"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.full_name", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "company",
            "order_number",
            "customer",
            "customer_name",
            "customer_phone",
            "quotation",
            "created_by",
            "created_by_name",
            "approved_by",
            "approved_by_name",
            "status",
            "status_display",
            "installation_date",
            "notes",
            "discount_total",
            "total_amount",
            "approved_at",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "company", "order_number", "status_display", "customer_name", "customer_phone",
            "created_by_name", "approved_by_name", "approved_at",
            "items", "created_at", "updated_at",
        ]
