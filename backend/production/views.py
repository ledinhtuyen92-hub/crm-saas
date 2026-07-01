from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from .models import ProductionOrder, ProductionStep
from .serializers import ProductionOrderSerializer, ProductionStepSerializer


class DefaultPageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class ProductionOrderViewSet(viewsets.ModelViewSet):
    serializer_class = ProductionOrderSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return (
            ProductionOrder.objects.select_related("order")
            .prefetch_related("steps")
            .order_by("-created_at", "-id")
        )


class ProductionStepViewSet(viewsets.ModelViewSet):
    serializer_class = ProductionStepSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return (
            ProductionStep.objects.select_related("production_order", "assigned_to")
            .order_by("production_order_id", "id")
        )
