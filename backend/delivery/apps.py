from django.apps import AppConfig


class DeliveryConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'delivery'
    verbose_name = 'Giao hàng & Bảo hành'

    crm_modules = [
        {"code": "delivery", "name": "Giao hàng"},
        {"code": "warranty", "name": "Bảo hành"}
    ]

    def ready(self):
        import delivery.signals  # noqa
