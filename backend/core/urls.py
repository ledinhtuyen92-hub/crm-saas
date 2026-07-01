from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    # Đấu nối API của module CRM vào cổng tổng /api/crm/
    path('api/crm/', include('crm.urls')),
    path('api/sales/', include('sales.urls')), 
    path('api/orders/', include('orders.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/production/', include('production.urls')),
]
