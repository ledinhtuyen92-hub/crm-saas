from rest_framework import serializers

from .models import SocialLead, ZaloMessageLog, ZaloMessageTemplate, ZaloOaConfig, ZaloMessage


# ── ZaloOaConfig ─────────────────────────────────────────────────────────────

class ZaloOaConfigSerializer(serializers.ModelSerializer):
    is_token_near_expiry = serializers.BooleanField(read_only=True)
    token_expires_at_display = serializers.SerializerMethodField()
    resolved_app_id = serializers.CharField(source='get_app_id', read_only=True)

    class Meta:
        model = ZaloOaConfig
        fields = [
            "id", "oa_name", "use_system_config", "app_id", "resolved_app_id", "oa_id", "secret_key",
            "access_token", "refresh_token", "token_expires_at",
            "token_expires_at_display", "is_token_near_expiry",
            "webhook_secret", "auto_send_payment_zns", "auto_send_delivery_zns", 
            "auto_send_birthday_zns", "auto_create_customer_from_phone", "lead_cleanup_days", "is_active", 
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "company", "created_at", "updated_at",
                            "is_token_near_expiry", "token_expires_at_display"]
        extra_kwargs = {
            "access_token": {"write_only": True},
            "refresh_token": {"write_only": True},
        }

    def get_token_expires_at_display(self, obj):
        if obj.token_expires_at:
            import django.utils.timezone as tz
            local_dt = obj.token_expires_at.astimezone(tz.get_current_timezone())
            return local_dt.strftime("%d/%m/%Y %H:%M")
        return None


class ZaloOaConfigWriteSerializer(serializers.ModelSerializer):
    """Dùng để tạo/cập nhật cấu hình OA."""
    class Meta:
        model = ZaloOaConfig
        fields = [
            "oa_name", "use_system_config", "app_id", "secret_key", "oa_id",
            "access_token", "refresh_token", "token_expires_at",
            "webhook_secret", "auto_send_payment_zns", "auto_send_delivery_zns", 
            "auto_send_birthday_zns", "auto_create_customer_from_phone", "lead_cleanup_days", "is_active",
        ]

    def validate(self, attrs):
        # Nếu dùng cấu hình hệ thống, xóa trống các trường cấu hình riêng để tránh lộ/nhầm lẫn dữ liệu
        if attrs.get('use_system_config', False):
            attrs['app_id'] = ""
            attrs['secret_key'] = ""
            attrs['webhook_secret'] = ""
        if attrs.get("access_token") and not attrs.get("token_expires_at"):
            from django.utils import timezone
            from datetime import timedelta
            attrs["token_expires_at"] = timezone.now() + timedelta(hours=25)
        return attrs


# ── SocialLead ───────────────────────────────────────────────────────────────

class SocialLeadListSerializer(serializers.ModelSerializer):
    """Serializer gọn cho danh sách (Inbox view)."""
    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True, default=None
    )
    oa_name = serializers.CharField(source="oa_config.oa_name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    platform_display = serializers.CharField(source="get_platform_display", read_only=True)
    is_converted = serializers.SerializerMethodField()
    is_customer_converted = serializers.SerializerMethodField()

    class Meta:
        model = SocialLead
        fields = [
            "id", "social_id", "display_name", "avatar_url",
            "platform", "platform_display", "oa_name", "oa_config",
            "last_message", "last_interaction_date",
            "status", "status_display",
            "assigned_to", "assigned_to_name",
            "is_converted", "detected_phone", "is_customer_converted",
            "created_at", "has_unread_message"
        ]

    def get_is_converted(self, obj):
        return obj.status == SocialLead.STATUS_CONVERTED

    def get_is_customer_converted(self, obj):
        if not obj.detected_phone:
            return obj.is_customer_converted
        from crm.models import Customer
        return Customer.objects.filter(company_id=obj.company_id, phone=obj.detected_phone).exists()


class SocialLeadDetailSerializer(serializers.ModelSerializer):
    """Serializer đầy đủ cho màn hình chi tiết / Inbox."""
    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True, default=None
    )
    oa_name = serializers.CharField(source="oa_config.oa_name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    platform_display = serializers.CharField(source="get_platform_display", read_only=True)
    converted_customer_id = serializers.SerializerMethodField()
    converted_customer_name = serializers.SerializerMethodField()
    is_customer_converted = serializers.SerializerMethodField()

    class Meta:
        model = SocialLead
        fields = [
            "id", "social_id", "display_name", "avatar_url",
            "platform", "platform_display", "oa_name", "oa_config",
            "last_message", "last_interaction_date",
            "status", "status_display",
            "assigned_to", "assigned_to_name",
            "notes",
            "converted_customer_id", "converted_customer_name", "has_unread_message",
            "detected_phone", "is_customer_converted",
            "created_at", "updated_at",
        ]

    def get_is_customer_converted(self, obj):
        if not obj.detected_phone:
            return obj.is_customer_converted
        from crm.models import Customer
        return Customer.objects.filter(company_id=obj.company_id, phone=obj.detected_phone).exists()

    def get_converted_customer_id(self, obj):
        if hasattr(obj, "converted_customer"):
            return obj.converted_customer.id
        return None

    def get_converted_customer_name(self, obj):
        if hasattr(obj, "converted_customer"):
            return obj.converted_customer.name
        return None


class SocialLeadUpdateSerializer(serializers.ModelSerializer):
    """Dùng để cập nhật note và phân công nhân viên."""
    class Meta:
        model = SocialLead
        fields = ["assigned_to", "notes"]


class ConvertLeadSerializer(serializers.Serializer):
    """Dùng cho action convert SocialLead -> Customer."""
    phone_number = serializers.CharField(max_length=20)
    customer_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    assigned_to = serializers.IntegerField(required=False, allow_null=True)

    def validate_phone_number(self, value):
        from zalo_integration.services import normalize_phone
        normalized = normalize_phone(value)
        if len(normalized) < 10:
            raise serializers.ValidationError("Số điện thoại không hợp lệ.")
        return normalized


# ── ZaloMessageTemplate ───────────────────────────────────────────────────────

class ZaloMessageTemplateSerializer(serializers.ModelSerializer):
    template_type_display = serializers.CharField(source="get_template_type_display", read_only=True)

    class Meta:
        model = ZaloMessageTemplate
        fields = [
            "id", "name", "zalo_template_id", "template_type",
            "template_type_display", "content_preview", "params_schema",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "company", "created_at", "updated_at", "template_type_display"]


class SendZNSSerializer(serializers.Serializer):
    """Dùng để gửi ZNS từ API."""
    template_id = serializers.IntegerField()
    recipient_phone = serializers.CharField(max_length=20)
    recipient_zalo_id = serializers.CharField(max_length=255, required=False, allow_blank=True)
    params = serializers.DictField(child=serializers.CharField(), default=dict)
    social_lead_id = serializers.IntegerField(required=False, allow_null=True)
    customer_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_recipient_phone(self, value):
        from zalo_integration.services import normalize_phone
        return normalize_phone(value)


class BulkSendZNSSerializer(serializers.Serializer):
    template_id = serializers.IntegerField()
    customer_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    params = serializers.DictField(child=serializers.CharField(), default=dict)


# ── ZaloMessageLog ────────────────────────────────────────────────────────────

class ZaloMessageLogSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    template_name = serializers.CharField(source="template.name", read_only=True, default=None)

    class Meta:
        model = ZaloMessageLog
        fields = [
            "id", "template_name", "recipient_phone", "recipient_zalo_id",
            "params_sent", "status", "status_display",
            "zalo_msg_id", "error_message", "sent_at",
            "social_lead", "customer",
        ]
        read_only_fields = fields


# ── ZaloMessage (Live Chat) ──────────────────────────────────────────────────

class ZaloMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = ZaloMessage
        fields = [
            "id", "social_lead", "direction", "content",
            "attachment_url", "attachment_type", "zalo_msg_id",
            "sender_user", "sender_name", "created_at",
        ]
        read_only_fields = ["id", "social_lead", "direction", "zalo_msg_id", "created_at"]

    def get_sender_name(self, obj):
        if obj.direction == ZaloMessage.DIRECTION_INBOUND:
            return obj.social_lead.display_name
        if obj.sender_user:
            return obj.sender_user.full_name or obj.sender_user.username
        return "Hệ thống"
