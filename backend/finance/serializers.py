from rest_framework import serializers
from .models import OrderPaymentMilestone, PaymentReceipt


class PaymentReceiptSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)

    class Meta:
        model = PaymentReceipt
        fields = [
            "id",
            "company",
            "receipt_code",
            "order",
            "milestone",
            "amount",
            "payment_method",
            "payment_method_display",
            "payment_date",
            "reference_code",
            "note",
            "created_by",
            "created_by_name",
            "attachments",
            "created_at",
        ]
        read_only_fields = ["id", "company", "receipt_code", "created_by", "created_by_name", "created_at"]

    def validate(self, attrs):
        order = attrs.get('order')
        amount = attrs.get('amount')
        
        if not self.instance and order and amount:
            if float(amount) > float(order.remaining_debt):
                raise serializers.ValidationError({"amount": f"Số tiền thu ({amount:,.0f} đ) không được vượt quá số tiền còn nợ của đơn hàng ({order.remaining_debt:,.0f} đ)."})
        return attrs


class OrderPaymentMilestoneSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    milestone_type_display = serializers.CharField(source="get_milestone_type_display", read_only=True)
    receipts = PaymentReceiptSerializer(many=True, read_only=True)

    class Meta:
        model = OrderPaymentMilestone
        fields = [
            "id",
            "company",
            "order",
            "milestone_type",
            "milestone_type_display",
            "title",
            "percentage",
            "amount",
            "paid_amount",
            "status",
            "status_display",
            "due_date",
            "note",
            "receipts",
            "created_at",
        ]
        read_only_fields = ["id", "company", "order", "paid_amount", "status", "status_display", "created_at"]
