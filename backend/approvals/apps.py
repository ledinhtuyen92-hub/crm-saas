from django.apps import AppConfig


class ApprovalsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'approvals'
    
    crm_modules = [
        {"code": "approvals", "name": "Phê duyệt"}
    ]
