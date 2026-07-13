from django.contrib import admin

from .models import SocialLead, ZaloMessageLog, ZaloMessageTemplate, ZaloOaConfig


@admin.register(ZaloOaConfig)
class ZaloOaConfigAdmin(admin.ModelAdmin):
    list_display = ["oa_name", "company", "app_id", "is_active", "token_expires_at"]
    list_filter = ["is_active", "company"]
    search_fields = ["oa_name", "app_id", "company__name"]
    readonly_fields = ["token_expires_at", "created_at", "updated_at"]


@admin.register(SocialLead)
class SocialLeadAdmin(admin.ModelAdmin):
    list_display = ["display_name", "social_id", "platform", "status", "company", "assigned_to", "last_interaction_date"]
    list_filter = ["platform", "status", "company"]
    search_fields = ["display_name", "social_id", "company__name"]
    readonly_fields = ["created_at", "updated_at", "last_interaction_date"]
    date_hierarchy = "last_interaction_date"


@admin.register(ZaloMessageTemplate)
class ZaloMessageTemplateAdmin(admin.ModelAdmin):
    list_display = ["name", "zalo_template_id", "template_type", "company", "is_active"]
    list_filter = ["template_type", "is_active", "company"]
    search_fields = ["name", "zalo_template_id", "company__name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(ZaloMessageLog)
class ZaloMessageLogAdmin(admin.ModelAdmin):
    list_display = ["recipient_phone", "template", "status", "company", "sent_at"]
    list_filter = ["status", "company"]
    search_fields = ["recipient_phone", "company__name"]
    readonly_fields = ["sent_at"]
    date_hierarchy = "sent_at"
