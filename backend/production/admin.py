from django.contrib import admin

from .models import ProductionOrder, ProductionStep


class ProductionStepInline(admin.TabularInline):
    model = ProductionStep
    extra = 0
    fields = ["sequence", "step_name", "assigned_to", "status", "started_at", "completed_at"]


@admin.register(ProductionOrder)
class ProductionOrderAdmin(admin.ModelAdmin):
    list_display = ["__str__", "order", "status", "start_date", "end_date", "company", "created_at"]
    list_filter = ["status", "company"]
    search_fields = ["order__order_number"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [ProductionStepInline]
    list_per_page = 30
    raw_id_fields = ["order"]
