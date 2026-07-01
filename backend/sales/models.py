from django.db import models


class Lead(models.Model):
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.CASCADE,
        related_name="leads",
    )
    status = models.CharField(max_length=50)
    value = models.DecimalField(max_digits=15, decimal_places=2)
    expected_close_date = models.DateField()
    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_leads",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=models.Q(value__gte=0), name="lead_value_gte_0"),
        ]

    def __str__(self):
        return f"{self.customer.name} - {self.status}"


class Quotation(models.Model):
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.PROTECT,
        related_name="quotations",
    )
    lead = models.ForeignKey(
        "sales.Lead",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotations",
    )
    quotation_number = models.CharField(max_length=50, unique=True)
    status = models.CharField(max_length=50)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(total_amount__gte=0),
                name="quotation_total_amount_gte_0",
            ),
        ]

    def __str__(self):
        return self.quotation_number


class QuotationItem(models.Model):
    quotation = models.ForeignKey(
        "sales.Quotation",
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
            models.CheckConstraint(check=models.Q(width__gt=0), name="quotation_item_width_gt_0"),
            models.CheckConstraint(check=models.Q(height__gt=0), name="quotation_item_height_gt_0"),
            models.CheckConstraint(check=models.Q(quantity__gt=0), name="quotation_item_quantity_gt_0"),
            models.CheckConstraint(
                check=models.Q(unit_price__gte=0),
                name="quotation_item_unit_price_gte_0",
            ),
        ]

    def __str__(self):
        return f"{self.quotation.quotation_number} - Product {self.product_id}"
