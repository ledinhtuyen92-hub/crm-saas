from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DeliveryOrderViewSet, WarrantyCardViewSet

router = DefaultRouter()
router.register("deliveries", DeliveryOrderViewSet, basename="delivery-order")
router.register("warranties", WarrantyCardViewSet, basename="warranty-card")

urlpatterns = [
    path("", include(router.urls)),
]
