from django.db import models
from django.utils import timezone


class Order(models.Model):
    """Đơn hàng — trung tâm của workflow: Chờ duyệt → Chấp thuận → Xuất kho."""

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CANCELLED = "cancelled"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Chờ duyệt"),
        (STATUS_APPROVED, "Đã chấp thuận"),
        (STATUS_REJECTED, "Đã từ chối"),
        (STATUS_CANCELLED, "Đã hủy"),
        (STATUS_COMPLETED, "Hoàn thành"),
    ]

    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="orders",
        verbose_name="Công ty",
    )
    order_number = models.CharField(
        max_length=50,
        verbose_name="Mã đơn hàng",
        help_text="Format: [PREFIX]-[YYYYMMDD]-[SEQ], VD: DH-20240101-001",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="Khách hàng",
    )
    quotation = models.ForeignKey(
        "sales.Quotation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name="Báo giá gốc",
    )
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_orders",
        verbose_name="Người tạo",
    )
    approved_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_orders",
        verbose_name="Người duyệt",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name="Trạng thái",
        db_index=True,
    )
    installation_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Ngày lắp đặt",
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
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Thời điểm duyệt",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Đơn hàng"
        verbose_name_plural = "Đơn hàng"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "order_number"],
                name="unique_order_number_per_company",
            ),
            models.CheckConstraint(
                check=models.Q(total_amount__gte=0),
                name="order_total_amount_gte_0",
            ),
            models.CheckConstraint(
                check=models.Q(discount_total__gte=0),
                name="order_discount_total_gte_0",
            ),
        ]

    def approve(self, approved_by_user):
        """
        Duyệt đơn hàng — chỉ gọi từ API view sau khi kiểm tra quyền.
        Tự động set approved_by, approved_at và trigger xuất kho.
        """
        if self.status != self.STATUS_PENDING:
            raise ValueError("Chỉ có thể duyệt đơn đang ở trạng thái 'Chờ duyệt'.")
        self.status = self.STATUS_APPROVED
        self.approved_by = approved_by_user
        self.approved_at = timezone.now()
        self.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):
    """Dòng sản phẩm trong đơn hàng — hỗ trợ kích thước (width × height) và chiết khấu."""

    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Đơn hàng",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="order_items",
        verbose_name="Sản phẩm",
    )
    # Snapshot thông tin sản phẩm tại thời điểm lập đơn
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

    class Meta:
        verbose_name = "Dòng đơn hàng"
        verbose_name_plural = "Dòng đơn hàng"
        constraints = [
            models.CheckConstraint(
                check=models.Q(quantity__gt=0),
                name="order_item_quantity_gt_0",
            ),
            models.CheckConstraint(
                check=models.Q(unit_price__gte=0),
                name="order_item_unit_price_gte_0",
            ),
            models.CheckConstraint(
                check=models.Q(discount_percent__gte=0) & models.Q(discount_percent__lte=100),
                name="order_item_discount_percent_valid",
            ),
        ]

    def __str__(self):
        return f"{self.order.order_number} — {self.product_name} x{self.quantity}"
