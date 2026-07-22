from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notifications"
    verbose_name = "Thông báo"
    crm_modules = [
        {"code": "notifications", "name": "Thông báo"},
    ]
