from django.db import models


class ProductCategory(models.Model):
    name = models.CharField(max_length=150, unique=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, unique=True)
    category = models.ForeignKey(
        "inventory.ProductCategory",
        on_delete=models.PROTECT,
        related_name="products",
    )
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(check=models.Q(price__gte=0), name="product_price_gte_0"),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku})"


class Warehouse(models.Model):
    name = models.CharField(max_length=150)
    location = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.name


class Inventory(models.Model):
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.CASCADE,
        related_name="inventories",
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.CASCADE,
        related_name="inventories",
    )
    quantity = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["product", "warehouse"],
                name="unique_inventory_product_warehouse",
            ),
            models.CheckConstraint(
                check=models.Q(quantity__gte=0),
                name="inventory_quantity_gte_0",
            ),
        ]

    def __str__(self):
        return f"{self.product.sku} - {self.warehouse.name}: {self.quantity}"


class InventoryTransaction(models.Model):
    TYPE_IMPORT = "import"
    TYPE_EXPORT = "export"
    TYPE_ADJUST = "adjust"

    TYPE_CHOICES = [
        (TYPE_IMPORT, "Import"),
        (TYPE_EXPORT, "Export"),
        (TYPE_ADJUST, "Adjust"),
    ]

    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="inventory_transactions",
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.PROTECT,
        related_name="inventory_transactions",
    )
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quantity = models.IntegerField()
    reference_id = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(quantity__gt=0),
                name="inventory_transaction_quantity_gt_0",
            ),
        ]

    def __str__(self):
        return f"{self.get_type_display()} {self.product.sku} - {self.quantity}"
