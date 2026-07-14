from rest_framework import serializers

from .models import FacebookPageConfig, FacebookLead, FacebookMessage


# ── FacebookPageConfig ────────────────────────────────────────────────────────

class FacebookPageConfigSerializer(serializers.ModelSerializer):
    is_token_valid = serializers.BooleanField(read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True, default="")

    class Meta:
        model = FacebookPageConfig
        fields = [
            "id", "page_name", "page_id", "page_access_token", "webhook_verify_token",
            "page_avatar", "is_active", "is_token_valid",
            "auto_create_customer_from_phone",
            "assigned_to", "assigned_to_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "is_token_valid"]
        extra_kwargs = {
            "page_access_token": {"write_only": True},
        }


# ── FacebookMessage ───────────────────────────────────────────────────────────

class FacebookMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacebookMessage
        fields = [
            "id", "fb_message_id", "sender_type", "text",
            "attachment_url", "attachment_type", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# ── FacebookLead ──────────────────────────────────────────────────────────────

class FacebookLeadSerializer(serializers.ModelSerializer):
    status = serializers.CharField(read_only=True)
    page_name = serializers.CharField(source="page_config.page_name", read_only=True)
    page_id = serializers.CharField(source="page_config.page_id", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True, default=None)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True, default=None)
    messages = FacebookMessageSerializer(many=True, read_only=True)

    class Meta:
        model = FacebookLead
        fields = [
            "id", "fb_user_id", "fb_user_name", "fb_user_avatar",
            "page_id", "page_name", "page_config",
            "detected_phone", "is_customer_converted", "status",
            "customer", "customer_name",
            "assigned_to", "assigned_to_name",
            "last_message_at", "last_message_preview",
            "messages",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "company", "fb_user_id", "status", "created_at", "updated_at"]


class FacebookLeadListSerializer(serializers.ModelSerializer):
    """Serializer nhẹ hơn dùng cho danh sách (không include messages)."""
    status = serializers.CharField(read_only=True)
    page_name = serializers.CharField(source="page_config.page_name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True, default=None)

    class Meta:
        model = FacebookLead
        fields = [
            "id", "fb_user_id", "fb_user_name", "fb_user_avatar",
            "page_id", "page_name", "page_config",
            "detected_phone", "is_customer_converted", "status",
            "customer", "customer_name",
            "last_message_at", "last_message_preview",
            "created_at",
        ]
