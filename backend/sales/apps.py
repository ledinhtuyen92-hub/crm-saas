from django.apps import AppConfig


class SalesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sales'
    
    crm_modules = [
        {"code": "sales", "name": "Bán hàng (Báo giá)"}
    ]
