from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    InventoryTransactionViewSet,
    ProductCategoryViewSet,
    ProductViewSet,
    StockLevelViewSet,
    WarehouseViewSet,
    ProductTemplateViewSet,
    ProductAttributeViewSet,
    ProductAttributeValueViewSet,
)

router = DefaultRouter()
router.register("product-categories", ProductCategoryViewSet, basename="product-category")
router.register("products", ProductViewSet, basename="product")
router.register("product-templates", ProductTemplateViewSet, basename="product-template")
router.register("product-attributes", ProductAttributeViewSet, basename="product-attribute")
router.register("product-attribute-values", ProductAttributeValueViewSet, basename="product-attribute-value")
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
