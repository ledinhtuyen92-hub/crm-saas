from django.urls import path

from . import views

app_name = "dashboard"

urlpatterns = [
    path("summary/", views.summary, name="summary"),
    path("revenue-chart/", views.revenue_chart, name="revenue-chart"),
    path("orders-by-status/", views.orders_by_status, name="orders-by-status"),
    path("top-customers/", views.top_customers, name="top-customers"),
    path("top-sellers/", views.top_sellers, name="top-sellers"),
]
