from rest_framework import serializers

from .models import ProductionOrder, ProductionStep


class ProductionStepSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True)

    class Meta:
        model = ProductionStep
        fields = [
            "id",
            "production_order",
            "step_name",
            "sequence",
            "assigned_to",
            "assigned_to_name",
            "status",
            "status_display",
            "started_at",
            "completed_at",
            "notes",
        ]
        read_only_fields = ["id", "status_display", "assigned_to_name"]


class ProductionOrderSerializer(serializers.ModelSerializer):
    steps = ProductionStepSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    delivery_status = serializers.SerializerMethodField()

    class Meta:
        model = ProductionOrder
        fields = [
            "id",
            "company",
            "order",
            "production_order_code",
            "order_number",
            "status",
            "status_display",
            "delivery_status",
            "start_date",
            "end_date",
            "notes",
            "steps",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "company", "production_order_code", "order_number", 
            "status_display", "delivery_status", "created_at", "updated_at"
        ]

    def get_delivery_status(self, obj):
        if obj.order and hasattr(obj.order, 'delivery_order'):
            return obj.order.delivery_order.status
        return None
