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

    class Meta:
        model = ProductionOrder
        fields = [
            "id",
            "company",
            "order",
            "order_number",
            "status",
            "status_display",
            "start_date",
            "end_date",
            "notes",
            "steps",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "company", "steps", "status_display",
            "order_number", "created_at", "updated_at",
        ]
