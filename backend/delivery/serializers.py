from rest_framework import serializers

from .models import DeliveryOrder, WarrantyCard


class DeliveryOrderSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    customer_name = serializers.CharField(source="order.customer.name", read_only=True)
    customer_phone = serializers.CharField(source="order.customer.phone", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = DeliveryOrder
        fields = [
            "id",
            "company",
            "order",
            "order_number",
            "customer_name",
            "customer_phone",
            "delivery_code",
            "status",
            "status_display",
            "shipper_user",
            "shipper_name",
            "shipper_phone",
            "shipping_address",
            "expected_date",
            "actual_date",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "delivery_code", "status_display", "created_at", "updated_at"]


class WarrantyCardSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = WarrantyCard
        fields = [
            "id",
            "company",
            "order",
            "order_number",
            "customer",
            "customer_name",
            "customer_phone",
            "warranty_code",
            "status",
            "status_display",
            "start_date",
            "end_date",
            "terms",
            "warranty_content",
            "warranty_rules",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "warranty_code", "status_display", "created_at", "updated_at"]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        from django.utils import timezone
        if ret.get("status") == "active" and instance.end_date and instance.end_date < timezone.now().date():
            ret["status"] = "expired"
            ret["status_display"] = "Hết hạn"
        return ret
