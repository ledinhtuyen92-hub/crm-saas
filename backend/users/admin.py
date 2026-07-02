from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Company, Permission, Role, User


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["name", "workspace_id", "tax_code", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "workspace_id", "tax_code"]
    prepopulated_fields = {}
    readonly_fields = ["created_at"]


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "module"]
    list_filter = ["module"]
    search_fields = ["code", "name"]
    ordering = ["module", "code"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name", "company", "get_permission_count"]
    list_filter = ["company"]
    search_fields = ["name", "company__name"]
    filter_horizontal = ["permissions"]

    @admin.display(description="Số quyền")
    def get_permission_count(self, obj):
        return obj.permissions.count()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = [
        "username", "full_name", "email", "company", "role",
        "is_company_admin", "is_active", "is_superuser",
    ]
    list_filter = ["is_company_admin", "is_active", "is_superuser", "company"]
    search_fields = ["username", "full_name", "email"]
    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Thông tin CRM SaaS",
            {
                "fields": (
                    "full_name", "phone", "job_title",
                    "company", "role", "is_company_admin", "department_id",
                )
            },
        ),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            "Thông tin CRM SaaS",
            {
                "fields": (
                    "full_name", "email", "phone", "job_title",
                    "company", "role", "is_company_admin",
                )
            },
        ),
    )
