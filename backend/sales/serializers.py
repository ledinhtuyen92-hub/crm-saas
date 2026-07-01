from rest_framework import serializers

from .models import Lead, Quotation, QuotationItem


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = [
            "id",
            "customer",
            "status",
            "value",
            "expected_close_date",
            "assigned_to",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = [
            "id",
            "quotation",
            "product_id",
            "width",
            "height",
            "quantity",
            "unit_price",
        ]
        read_only_fields = ["id"]


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, read_only=True)

    class Meta:
        model = Quotation
        fields = [
            "id",
            "customer",
            "lead",
            "quotation_number",
            "status",
            "total_amount",
            "items",
            "created_at",
        ]
        read_only_fields = ["id", "items", "created_at"]
