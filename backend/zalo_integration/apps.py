from django.apps import AppConfig


class ZaloIntegrationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "zalo_integration"
    verbose_name = "Tích hợp Zalo"

    crm_modules = [
        {"code": "zalo", "name": "Zalo Integration & Omnichannel"}
    ]

    def ready(self):
        import zalo_integration.signals
