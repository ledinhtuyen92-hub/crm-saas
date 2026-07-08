from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import QuotationItemViewSet, QuotationViewSet, QuotationTemplateViewSet

router = DefaultRouter()
router.register("quotations", QuotationViewSet, basename="quotation")
router.register("quotation-items", QuotationItemViewSet, basename="quotation-item")
router.register("quotation-templates", QuotationTemplateViewSet, basename="quotation-template")

urlpatterns = [
    path("", include(router.urls)),
]
