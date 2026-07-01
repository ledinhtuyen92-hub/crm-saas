from django.db import models


class Order(models.Model):
    order_number = models.CharField(max_length=50, unique=True)
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.PROTECT,
        related_name="orders",
    )
    quotation = models.ForeignKey(
        "sales.Quotation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    status = models.CharField(max_length=50)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    order_date = models.DateField()
    delivery_date = models.DateField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(total_amount__gte=0),
                name="order_total_amount_gte_0",
            ),
            models.CheckConstraint(
                check=models.Q(delivery_date__gte=models.F("order_date")),
                name="delivery_date_gte_order_date",
            ),
        ]

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="items",
    )
    product_id = models.IntegerField()
    width = models.DecimalField(max_digits=10, decimal_places=2)
    height = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(check=models.Q(width__gt=0), name="order_item_width_gt_0"),
            models.CheckConstraint(check=models.Q(height__gt=0), name="order_item_height_gt_0"),
            models.CheckConstraint(check=models.Q(quantity__gt=0), name="order_item_quantity_gt_0"),
            models.CheckConstraint(
                check=models.Q(unit_price__gte=0),
                name="order_item_unit_price_gte_0",
            ),
        ]

    def __str__(self):
        return f"{self.order.order_number} - Product {self.product_id}"
