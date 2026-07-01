from rest_framework import serializers

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id",
            "order",
            "product_id",
            "width",
            "height",
            "quantity",
            "unit_price",
        ]
        read_only_fields = ["id"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "customer",
            "quotation",
            "status",
            "total_amount",
            "order_date",
            "delivery_date",
            "items",
        ]
        read_only_fields = ["id", "items"]
