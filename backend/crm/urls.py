from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CustomerContactViewSet, CustomerInteractionViewSet, CustomerViewSet

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("customer-contacts", CustomerContactViewSet, basename="customer-contact")
router.register(
    "customer-interactions",
    CustomerInteractionViewSet,
    basename="customer-interaction",
)

urlpatterns = [
    path("", include(router.urls)),
]
