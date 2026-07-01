from rest_framework import serializers

from .models import ProductionOrder, ProductionStep


class ProductionStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionStep
        fields = [
            "id",
            "production_order",
            "step_name",
            "assigned_to",
            "status",
            "started_at",
            "completed_at",
        ]
        read_only_fields = ["id"]


class ProductionOrderSerializer(serializers.ModelSerializer):
    steps = ProductionStepSerializer(many=True, read_only=True)

    class Meta:
        model = ProductionOrder
        fields = [
            "id",
            "order",
            "status",
            "start_date",
            "end_date",
            "steps",
            "created_at",
        ]
        read_only_fields = ["id", "steps", "created_at"]
