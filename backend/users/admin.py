from django.contrib import admin

from .models import Company, CompanySettings, Permission, Role, User


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["name", "workspace_id", "tax_code", "phone", "is_active", "user_limit", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "workspace_id", "tax_code"]
    readonly_fields = ["created_at"]
    list_per_page = 30


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = ["company", "order_prefix", "lead_routing", "timezone"]
    search_fields = ["company__name"]


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "module"]
    list_filter = ["module"]
    search_fields = ["code", "name"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name", "company", "get_permission_count"]
    list_filter = ["company"]
    search_fields = ["name", "company__name"]
    filter_horizontal = ["permissions"]

    def get_permission_count(self, obj):
        return obj.permissions.count()
    get_permission_count.short_description = "Số quyền"


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ["username", "full_name", "email", "company", "role", "is_company_admin", "is_active", "created_at"]
    list_filter = ["is_company_admin", "is_active", "company"]
    search_fields = ["username", "full_name", "email"]
    readonly_fields = ["created_at", "last_login", "date_joined"]
    list_per_page = 30
