"""
facebook_integration/apps.py
"""

from django.apps import AppConfig


class FacebookIntegrationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "facebook_integration"
    verbose_name = "Tích hợp Facebook"

    crm_modules = [
        {"code": "facebook", "name": "Facebook Multi-Page Inbox"}
    ]

    def ready(self):
        import facebook_integration.signals  # noqa: F401
