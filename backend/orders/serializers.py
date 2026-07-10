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
            "note",
            "length",
            "area",
            "spec",
            "warranty",
            "thickness",
            "product_image",
            "custom_data",
        ]
        read_only_fields = ["id", "line_total"]


from sales.serializers import get_company_info_dict, QuotationSerializer

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    quotation_detail = QuotationSerializer(source="quotation", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.full_name", read_only=True)
    financial_status_display = serializers.CharField(source="get_financial_status_display", read_only=True)
    paid_amount = serializers.FloatField(read_only=True)
    remaining_debt = serializers.FloatField(read_only=True)
    company_info = serializers.SerializerMethodField()

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
            "quotation_detail",
            "created_by",
            "created_by_name",
            "approved_by",
            "approved_by_name",
            "status",
            "status_display",
            "financial_status",
            "financial_status_display",
            "payment_term",
            "payment_terms_schedule",
            "paid_amount",
            "remaining_debt",
            "installation_date",
            "notes",
            "shipping_fee",
            "installation_fee",
            "delivery_time",
            "validity_days",
            "subtotal",
            "vat_rate",
            "vat_amount",
            "discount_total",
            "total_amount",
            "approved_at",
            "custom_data",
            "items",
            "created_at",
            "updated_at",
            "company_info",
        ]
        read_only_fields = [
            "id", "company", "order_number", "status_display", "financial_status_display",
            "paid_amount", "remaining_debt",
            "customer_name", "customer_phone",
            "created_by_name", "approved_by_name", "approved_at",
            "items", "created_at", "updated_at", "company_info", "quotation_detail",
        ]

    def get_company_info(self, obj):
        return get_company_info_dict(self, obj)
