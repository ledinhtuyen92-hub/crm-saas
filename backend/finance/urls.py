from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderPaymentMilestoneViewSet, PaymentReceiptViewSet

router = DefaultRouter()
router.register(r"milestones", OrderPaymentMilestoneViewSet, basename="milestone")
router.register(r"receipts", PaymentReceiptViewSet, basename="receipt")

urlpatterns = [
    path("", include(router.urls)),
]
