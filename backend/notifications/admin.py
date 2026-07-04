from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["title", "type", "recipient", "company", "is_read", "created_at"]
    list_filter = ["type", "is_read", "company"]
    search_fields = ["title", "message", "recipient__full_name"]
    readonly_fields = ["created_at"]
    list_per_page = 50
