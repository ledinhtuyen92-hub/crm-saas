from django.core.management.base import BaseCommand
from users.models import CompanySettings, Permission

class Command(BaseCommand):
    help = "Activate all modules for the first company"

    def handle(self, *args, **options):
        c = CompanySettings.objects.first()
        if not c:
            self.stdout.write("No company settings found.")
            return

        all_modules = list(set(Permission.objects.values_list('module', flat=True)))
        active = [m for m in all_modules if m not in ["dashboard", "settings", "notifications", "reports", "other"]]
        
        c.active_modules = active
        c.save(update_fields=['active_modules'])
        self.stdout.write(f"Successfully activated modules: {active}")
