from django.apps import AppConfig


class InventoryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "inventory"
    verbose_name = "Kho vận & Sản phẩm"
    
    crm_modules = [
        {"code": "products", "name": "Sản phẩm & Dịch vụ"},
        {"code": "inventory", "name": "Kho vận"}
    ]
