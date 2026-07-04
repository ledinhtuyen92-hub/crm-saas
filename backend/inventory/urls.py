from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    InventoryTransactionViewSet,
    ProductCategoryViewSet,
    ProductViewSet,
    StockLevelViewSet,
    WarehouseViewSet,
)

router = DefaultRouter()
router.register("product-categories", ProductCategoryViewSet, basename="product-category")
router.register("products", ProductViewSet, basename="product")
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("stock-levels", StockLevelViewSet, basename="stock-level")
router.register(
    "transactions",
    InventoryTransactionViewSet,
    basename="inventory-transaction",
)

urlpatterns = [
    path("", include(router.urls)),
]
