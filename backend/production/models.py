from django.db import models


class ProductionOrder(models.Model):
    """Lệnh sản xuất — được tạo tự động hoặc thủ công sau khi đơn hàng được duyệt."""

    STATUS_PENDING = "pending"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Chờ sản xuất"),
        (STATUS_IN_PROGRESS, "Đang sản xuất"),
        (STATUS_COMPLETED, "Hoàn thành"),
        (STATUS_CANCELLED, "Đã hủy"),
    ]

    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="production_orders",
        verbose_name="Công ty",
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.PROTECT,
        related_name="production_orders",
        verbose_name="Đơn hàng",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name="Trạng thái",
        db_index=True,
    )
    start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Ngày bắt đầu sản xuất",
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Ngày kết thúc dự kiến",
    )
    notes = models.TextField(blank=True, verbose_name="Ghi chú")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Lệnh sản xuất"
        verbose_name_plural = "Lệnh sản xuất"
        ordering = ["-created_at"]
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
        return f"LSX-{self.pk:04d} — {self.order.order_number}"


class ProductionStep(models.Model):
    """Công đoạn sản xuất trong một lệnh sản xuất."""

    STATUS_PENDING = "pending"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_DONE = "done"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Chờ thực hiện"),
        (STATUS_IN_PROGRESS, "Đang thực hiện"),
        (STATUS_DONE, "Hoàn thành"),
    ]

    production_order = models.ForeignKey(
        "production.ProductionOrder",
        on_delete=models.CASCADE,
        related_name="steps",
        verbose_name="Lệnh sản xuất",
    )
    step_name = models.CharField(max_length=150, verbose_name="Tên công đoạn")
    sequence = models.PositiveSmallIntegerField(
        default=1,
        verbose_name="Thứ tự",
        help_text="Số thứ tự thực hiện trong lệnh sản xuất.",
    )
    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_production_steps",
        verbose_name="Nhân viên phụ trách",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name="Trạng thái",
    )
    started_at = models.DateTimeField(null=True, blank=True, verbose_name="Thời điểm bắt đầu")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="Thời điểm hoàn thành")
    notes = models.TextField(blank=True, verbose_name="Ghi chú công đoạn")

    class Meta:
        verbose_name = "Công đoạn sản xuất"
        verbose_name_plural = "Công đoạn sản xuất"
        ordering = ["production_order", "sequence"]
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
        return f"{self.production_order} — Bước {self.sequence}: {self.step_name}"
