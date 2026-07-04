from django.contrib import admin

from .models import Customer, CustomerContact, CustomerInteraction, CustomerTag


@admin.register(CustomerTag)
class CustomerTagAdmin(admin.ModelAdmin):
    list_display = ["name", "color", "company"]
    list_filter = ["company"]
    search_fields = ["name", "company__name"]


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "email", "status", "source", "assigned_to", "company", "created_at"]
    list_filter = ["status", "source", "company"]
    search_fields = ["name", "phone", "email"]
    readonly_fields = ["created_at", "updated_at"]
    list_per_page = 30
    raw_id_fields = ["assigned_to", "created_by"]


@admin.register(CustomerContact)
class CustomerContactAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "email", "position", "customer"]
    search_fields = ["name", "phone", "customer__name"]
    raw_id_fields = ["customer"]


@admin.register(CustomerInteraction)
class CustomerInteractionAdmin(admin.ModelAdmin):
    list_display = ["customer", "type", "result", "created_by", "next_follow_up", "created_at"]
    list_filter = ["type", "result"]
    search_fields = ["customer__name", "content"]
    readonly_fields = ["created_at"]
    raw_id_fields = ["customer", "created_by"]
