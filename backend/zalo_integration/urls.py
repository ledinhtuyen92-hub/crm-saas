from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ZaloMessageLogViewSet,
    ZaloMessageTemplateViewSet,
    ZaloOaConfigViewSet,
    ZaloWebhookView,
    SocialLeadViewSet,
)

router = DefaultRouter()
router.register(r"config", ZaloOaConfigViewSet, basename="zalo-config")
router.register(r"social-leads", SocialLeadViewSet, basename="social-lead")
router.register(r"templates", ZaloMessageTemplateViewSet, basename="zalo-template")
router.register(r"message-logs", ZaloMessageLogViewSet, basename="zalo-log")

urlpatterns = [
    # Webhook endpoint (Public — Zalo server gọi vào, không cần JWT)
    path("webhook/", ZaloWebhookView.as_view(), name="zalo-webhook"),

    # API endpoints (JWT required, filter theo company)
    path("", include(router.urls)),
]
