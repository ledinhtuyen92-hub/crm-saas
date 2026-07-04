from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import QuotationItemViewSet, QuotationViewSet

router = DefaultRouter()
router.register("quotations", QuotationViewSet, basename="quotation")
router.register("quotation-items", QuotationItemViewSet, basename="quotation-item")

urlpatterns = [
    path("", include(router.urls)),
]
