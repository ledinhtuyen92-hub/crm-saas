"""
facebook_integration/urls.py
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FacebookLeadViewSet, FacebookPageConfigViewSet, FacebookWebhookView, QuickMediaAssetViewSet

router = DefaultRouter()
router.register(r"pages", FacebookPageConfigViewSet, basename="facebook-pages")
router.register(r"leads", FacebookLeadViewSet, basename="facebook-leads")
router.register(r"quick-media", QuickMediaAssetViewSet, basename="facebook-quick-media")

urlpatterns = [
    path("webhook/", FacebookWebhookView.as_view(), name="facebook-webhook"),
    path("", include(router.urls)),
]
