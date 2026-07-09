from django.apps import AppConfig


class CrmConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "crm"
    verbose_name = "Khách hàng"
    
    crm_modules = [
        {"code": "crm", "name": "CRM (Khách hàng)"}
    ]

    def ready(self):
        import crm.signals  # noqa: F401 — register signal handlers
