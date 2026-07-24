from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CustomerContactViewSet,
    CustomerInteractionViewSet,
    CustomerTagViewSet,
    CustomerViewSet,
)

from .api_webhooks import WebsiteIntegrationWebhookView

router = DefaultRouter()
router.register("tags", CustomerTagViewSet, basename="customer-tag")
router.register("customers", CustomerViewSet, basename="customer")
router.register("contacts", CustomerContactViewSet, basename="customer-contact")
router.register("interactions", CustomerInteractionViewSet, basename="customer-interaction")

urlpatterns = [
    path("webhooks/website/", WebsiteIntegrationWebhookView.as_view(), name="website-webhook"),
    path("", include(router.urls)),
]
