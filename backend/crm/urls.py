from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CustomerContactViewSet,
    CustomerInteractionViewSet,
    CustomerTagViewSet,
    CustomerViewSet,
)

router = DefaultRouter()
router.register("tags", CustomerTagViewSet, basename="customer-tag")
router.register("customers", CustomerViewSet, basename="customer")
router.register("contacts", CustomerContactViewSet, basename="customer-contact")
router.register("interactions", CustomerInteractionViewSet, basename="customer-interaction")

urlpatterns = [
    path("", include(router.urls)),
]
