from django.contrib import admin

from .models import InventoryTransaction, Product, ProductCategory, StockLevel, Warehouse


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "description", "company"]
    list_filter = ["company"]
    search_fields = ["name", "company__name"]


class StockLevelInline(admin.TabularInline):
    model = StockLevel
    extra = 0
    readonly_fields = ["is_low_stock"]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["sku", "name", "category", "unit", "price", "cost_price", "is_active", "company"]
    list_filter = ["is_active", "category", "company", "unit"]
    search_fields = ["sku", "name"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [StockLevelInline]
    list_per_page = 30


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ["name", "location", "is_active", "company"]
    list_filter = ["is_active", "company"]
    search_fields = ["name", "company__name"]


@admin.register(StockLevel)
class StockLevelAdmin(admin.ModelAdmin):
    list_display = ["product", "warehouse", "quantity", "min_quantity", "is_low_stock"]
    list_filter = ["warehouse"]
    search_fields = ["product__sku", "product__name"]


@admin.register(InventoryTransaction)
class InventoryTransactionAdmin(admin.ModelAdmin):
    list_display = [
        "transaction_code", "type", "product", "warehouse",
        "quantity", "unit_cost", "reference_order", "created_by", "created_at"
    ]
    list_filter = ["type", "company", "warehouse"]
    search_fields = ["transaction_code", "product__sku"]
    readonly_fields = ["created_at"]
    raw_id_fields = ["product", "warehouse", "reference_order", "created_by"]
    list_per_page = 30
