from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    InventoryTransactionViewSet,
    InventoryViewSet,
    ProductCategoryViewSet,
    ProductViewSet,
    WarehouseViewSet,
)

router = DefaultRouter()
router.register("product-categories", ProductCategoryViewSet, basename="product-category")
router.register("products", ProductViewSet, basename="product")
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("inventories", InventoryViewSet, basename="inventory")
router.register(
    "inventory-transactions",
    InventoryTransactionViewSet,
    basename="inventory-transaction",
)

urlpatterns = [
    path("", include(router.urls)),
]
