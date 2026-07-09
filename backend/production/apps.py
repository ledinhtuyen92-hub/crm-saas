from django.apps import AppConfig


class ProductionConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "production"
    verbose_name = "Sản xuất"
    
    crm_modules = [
        {"code": "production", "name": "Sản xuất"}
    ]
