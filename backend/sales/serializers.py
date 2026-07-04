from rest_framework import serializers

from .models import Quotation, QuotationItem


class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = [
            "id",
            "quotation",
            "product",
            "product_name",
            "unit_price",
            "width",
            "height",
            "quantity",
            "discount_percent",
            "line_total",
            "note",
        ]
        read_only_fields = ["id", "line_total"]


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)

    class Meta:
        model = Quotation
        fields = [
            "id",
            "company",
            "quotation_number",
            "customer",
            "customer_name",
            "created_by",
            "created_by_name",
            "status",
            "status_display",
            "installation_date",
            "notes",
            "discount_total",
            "total_amount",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "company", "quotation_number", "items", "status_display",
            "customer_name", "created_by_name", "created_at", "updated_at",
        ]
