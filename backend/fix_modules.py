import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from users.models import CompanySettings, Permission

# Activate all modules for the first company
c = CompanySettings.objects.first()
all_modules = list(set(Permission.objects.values_list('module', flat=True)))

print("Before:", c.active_modules)
# Bỏ qua dashboard, settings, notifications, reports vì chúng là core modules
active = [m for m in all_modules if m not in ["dashboard", "settings", "notifications", "reports", "other"]]
c.active_modules = active
c.save(update_fields=['active_modules'])

print("After:", c.active_modules)
