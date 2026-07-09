from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import QuotationItemViewSet, QuotationViewSet, QuotationTemplateViewSet, PublicQuotationView

router = DefaultRouter()
router.register("quotations", QuotationViewSet, basename="quotation")
router.register("quotation-items", QuotationItemViewSet, basename="quotation-item")
router.register("quotation-templates", QuotationTemplateViewSet, basename="quotation-template")

urlpatterns = [
    path("public-quotations/<uuid:public_token>/", PublicQuotationView.as_view(), name="public-quotation-detail"),
    path("", include(router.urls)),
]
