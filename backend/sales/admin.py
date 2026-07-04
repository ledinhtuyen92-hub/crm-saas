from django.contrib import admin

from .models import Quotation, QuotationItem


class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 0
    readonly_fields = ["line_total"]
    fields = ["product", "product_name", "unit_price", "width", "height", "quantity", "discount_percent", "line_total", "note"]


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ["quotation_number", "customer", "status", "total_amount", "company", "created_by", "created_at"]
    list_filter = ["status", "company"]
    search_fields = ["quotation_number", "customer__name"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [QuotationItemInline]
    list_per_page = 30
    raw_id_fields = ["customer", "created_by"]
