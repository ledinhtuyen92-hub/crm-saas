from django.db import models


class Quotation(models.Model):
    """Báo giá — được tạo từ profile khách hàng, có thể chuyển thành Đơn hàng."""

    STATUS_DRAFT = "draft"
    STATUS_SENT = "sent"
    STATUS_ACCEPTED = "accepted"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Nháp"),
        (STATUS_SENT, "Đã gửi"),
        (STATUS_ACCEPTED, "Đã chấp nhận"),
        (STATUS_REJECTED, "Đã từ chối"),
    ]

    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="quotations",
        verbose_name="Công ty",
    )
    quotation_number = models.CharField(
        max_length=50,
        verbose_name="Mã báo giá",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.PROTECT,
        related_name="quotations",
        verbose_name="Khách hàng",
    )
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_quotations",
        verbose_name="Người tạo",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        verbose_name="Trạng thái",
    )
    installation_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Ngày lắp đặt dự kiến",
    )
    notes = models.TextField(blank=True, verbose_name="Ghi chú")
    discount_total = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        verbose_name="Tổng chiết khấu",
    )
    total_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        verbose_name="Tổng tiền",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Báo giá"
        verbose_name_plural = "Báo giá"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "quotation_number"],
                name="unique_quotation_number_per_company",
            ),
            models.CheckConstraint(
                check=models.Q(total_amount__gte=0),
                name="quotation_total_amount_gte_0",
            ),
            models.CheckConstraint(
                check=models.Q(discount_total__gte=0),
                name="quotation_discount_total_gte_0",
            ),
        ]

    def __str__(self):
        return self.quotation_number


class QuotationItem(models.Model):
    """Dòng sản phẩm trong báo giá — hỗ trợ kích thước (width × height) và chiết khấu."""

    quotation = models.ForeignKey(
        "sales.Quotation",
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Báo giá",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="quotation_items",
        verbose_name="Sản phẩm",
    )
    # Snapshot thông tin sản phẩm tại thời điểm lập báo giá
    product_name = models.CharField(
        max_length=255,
        verbose_name="Tên sản phẩm (snapshot)",
    )
    unit_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        verbose_name="Đơn giá (snapshot)",
    )
    # Kích thước (đặc thù ngành: cửa nhôm, nội thất...)
    width = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Chiều rộng (m)",
    )
    height = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Chiều cao (m)",
    )
    quantity = models.PositiveIntegerField(default=1, verbose_name="Số lượng")
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name="Chiết khấu (%)",
    )
    line_total = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        verbose_name="Thành tiền",
    )
    note = models.CharField(max_length=255, blank=True, verbose_name="Ghi chú dòng")

    class Meta:
        verbose_name = "Dòng báo giá"
        verbose_name_plural = "Dòng báo giá"
        constraints = [
            models.CheckConstraint(
                check=models.Q(quantity__gt=0),
                name="quotation_item_quantity_gt_0",
            ),
            models.CheckConstraint(
                check=models.Q(unit_price__gte=0),
                name="quotation_item_unit_price_gte_0",
            ),
            models.CheckConstraint(
                check=models.Q(discount_percent__gte=0) & models.Q(discount_percent__lte=100),
                name="quotation_item_discount_percent_valid",
            ),
        ]

    def __str__(self):
        return f"{self.quotation.quotation_number} — {self.product_name} x{self.quantity}"
