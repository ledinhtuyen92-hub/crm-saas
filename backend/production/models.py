from django.db import models


class ProductionOrder(models.Model):
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.PROTECT,
        related_name="production_orders",
    )
    status = models.CharField(max_length=50)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(start_date__isnull=True)
                    | models.Q(end_date__isnull=True)
                    | models.Q(end_date__gte=models.F("start_date"))
                ),
                name="production_order_end_date_gte_start_date",
            ),
        ]

    def __str__(self):
        return f"Production Order for {self.order.order_number}"


class ProductionStep(models.Model):
    production_order = models.ForeignKey(
        "production.ProductionOrder",
        on_delete=models.CASCADE,
        related_name="steps",
    )
    step_name = models.CharField(max_length=150)
    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_production_steps",
    )
    status = models.CharField(max_length=50)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(started_at__isnull=True)
                    | models.Q(completed_at__isnull=True)
                    | models.Q(completed_at__gte=models.F("started_at"))
                ),
                name="production_step_completed_at_gte_started_at",
            ),
        ]

    def __str__(self):
        return f"{self.production_order_id} - {self.step_name}"
