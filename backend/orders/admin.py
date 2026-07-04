from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ["line_total"]
    fields = ["product", "product_name", "unit_price", "width", "height", "quantity", "discount_percent", "line_total"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "order_number", "customer", "status", "total_amount",
        "company", "created_by", "approved_by", "approved_at", "created_at"
    ]
    list_filter = ["status", "company"]
    search_fields = ["order_number", "customer__name"]
    readonly_fields = ["created_at", "updated_at", "approved_at"]
    inlines = [OrderItemInline]
    list_per_page = 30
    raw_id_fields = ["customer", "quotation", "created_by", "approved_by"]
