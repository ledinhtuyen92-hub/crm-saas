from rest_framework import serializers

from .models import FacebookPageConfig, FacebookLead, FacebookMessage, QuickMediaAsset


# ── FacebookPageConfig ────────────────────────────────────────────────────────

class FacebookPageConfigSerializer(serializers.ModelSerializer):
    is_token_valid = serializers.BooleanField(read_only=True)
    is_token_near_expiry = serializers.BooleanField(read_only=True)
    resolved_app_id = serializers.CharField(source='get_app_id', read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True, default="")
    token_expires_at_display = serializers.SerializerMethodField()

    class Meta:
        model = FacebookPageConfig
        fields = [
            "id", "page_name", "page_id",
            "use_system_config", "app_id", "resolved_app_id",
            "page_access_token", "token_expires_at", "token_expires_at_display",
            "is_token_valid", "is_token_near_expiry",
            "webhook_verify_token", "page_avatar", "is_active",
            "auto_create_customer_from_phone", "lead_cleanup_days",
            "assigned_to", "assigned_to_name",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "is_token_valid",
                            "is_token_near_expiry", "token_expires_at_display"]
        extra_kwargs = {
            "page_access_token": {"write_only": True},
            "app_secret": {"write_only": True},
        }

    def get_token_expires_at_display(self, obj):
        if obj.token_expires_at:
            import django.utils.timezone as tz
            local_dt = obj.token_expires_at.astimezone(tz.get_current_timezone())
            return local_dt.strftime("%d/%m/%Y %H:%M")
        return "Không giới hạn (Page Token)"


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
    is_customer_converted = serializers.SerializerMethodField()

    def get_is_customer_converted(self, obj):
        if obj.customer_id:
            return True
        if not obj.detected_phone:
            return obj.is_customer_converted
        from crm.models import Customer
        company_id = getattr(obj, "company_id", None) or (obj.page_config.company_id if hasattr(obj, "page_config") and obj.page_config else None)
        if not company_id:
            return obj.is_customer_converted
        return Customer.objects.filter(company_id=company_id, phone=obj.detected_phone).exists()

    class Meta:
        model = FacebookLead
        fields = [
            "id", "fb_user_id", "fb_user_name", "fb_user_avatar",
            "page_id", "page_name", "page_config",
            "detected_phone", "is_customer_converted", "status", "is_archived",
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
    is_customer_converted = serializers.SerializerMethodField()

    def get_is_customer_converted(self, obj):
        if obj.customer_id:
            return True
        if not obj.detected_phone:
            return obj.is_customer_converted
        from crm.models import Customer
        company_id = getattr(obj, "company_id", None) or (obj.page_config.company_id if hasattr(obj, "page_config") and obj.page_config else None)
        if not company_id:
            return obj.is_customer_converted
        return Customer.objects.filter(company_id=company_id, phone=obj.detected_phone).exists()

    latest_sender = serializers.SerializerMethodField()

    def get_latest_sender(self, obj):
        if hasattr(obj, "latest_sender") and obj.latest_sender is not None:
            return obj.latest_sender
        last_m = obj.messages.order_by("-created_at").first()
        return last_m.sender_type if last_m else ""

    class Meta:
        model = FacebookLead
        fields = [
            "id", "fb_user_id", "fb_user_name", "fb_user_avatar",
            "page_id", "page_name", "page_config",
            "detected_phone", "is_customer_converted", "status", "is_archived",
            "customer", "customer_name",
            "last_message_at", "last_message_preview",
            "created_at", "latest_sender",
        ]


# ── QuickMediaAsset ───────────────────────────────────────────────────────────

class QuickMediaAssetSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True, default="")
    media_type_display = serializers.CharField(source="get_media_type_display", read_only=True)

    class Meta:
        model = QuickMediaAsset
        fields = [
            "id", "company", "title", "media_type", "media_type_display",
            "file_url", "created_by", "created_by_name", "created_at",
        ]
        read_only_fields = ["id", "company", "created_by", "created_at", "media_type_display"]

