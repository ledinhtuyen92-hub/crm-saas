from django.contrib import admin

from .models import Company, Permission, Role, User

admin.site.register(Company)
admin.site.register(Permission)
admin.site.register(Role)
admin.site.register(User)
