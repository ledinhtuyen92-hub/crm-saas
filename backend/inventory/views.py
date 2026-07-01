from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from .models import (
    Inventory,
    InventoryTransaction,
    Product,
    ProductCategory,
    Warehouse,
)
from .serializers import (
    InventorySerializer,
    InventoryTransactionSerializer,
    ProductCategorySerializer,
    ProductSerializer,
    WarehouseSerializer,
)


class DefaultPageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class ProductCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = ProductCategorySerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return ProductCategory.objects.order_by("name", "id")


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return Product.objects.select_related("category").order_by("name", "id")


class WarehouseViewSet(viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return Warehouse.objects.order_by("name", "id")


class InventoryViewSet(viewsets.ModelViewSet):
    serializer_class = InventorySerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return (
            Inventory.objects.select_related("product", "warehouse")
            .order_by("product__name", "warehouse__name", "id")
        )


class InventoryTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryTransactionSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return (
            InventoryTransaction.objects.select_related("product", "warehouse")
            .order_by("-created_at", "-id")
        )
