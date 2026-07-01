from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OrderItemViewSet, OrderViewSet

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")
router.register("order-items", OrderItemViewSet, basename="order-item")

urlpatterns = [
    path("", include(router.urls)),
]
