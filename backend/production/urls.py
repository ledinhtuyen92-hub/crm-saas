from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProductionOrderViewSet, ProductionStepViewSet

router = DefaultRouter()
router.register("orders", ProductionOrderViewSet, basename="production-order")
router.register("steps", ProductionStepViewSet, basename="production-step")

urlpatterns = [
    path("", include(router.urls)),
]
