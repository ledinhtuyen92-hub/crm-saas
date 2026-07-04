from django.db import models


class ProductCategory(models.Model):
    """Loại sản phẩm — cô lập theo từng công ty."""

    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="product_categories",
        verbose_name="Công ty",
    )
    name = models.CharField(max_length=150, verbose_name="Tên loại sản phẩm")
    description = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Mô tả",
    )

    class Meta:
        verbose_name = "Loại sản phẩm"
        verbose_name_plural = "Loại sản phẩm"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                name="unique_product_category_per_company",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.company.name})"


class Product(models.Model):
    """Sản phẩm / Dịch vụ — cô lập theo từng công ty."""

    UNIT_CAI = "cái"
    UNIT_M2 = "m²"
    UNIT_M = "m"
    UNIT_BO = "bộ"
    UNIT_KG = "kg"
    UNIT_LIT = "lít"
    UNIT_CHOICES = [
        (UNIT_CAI, "Cái"),
        (UNIT_M2, "m²"),
        (UNIT_M, "Mét"),
        (UNIT_BO, "Bộ"),
        (UNIT_KG, "Kg"),
        (UNIT_LIT, "Lít"),
    ]

    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="products",
        verbose_name="Công ty",
    )
    category = models.ForeignKey(
        "inventory.ProductCategory",
        on_delete=models.PROTECT,
        related_name="products",
        verbose_name="Loại sản phẩm",
    )
    sku = models.CharField(max_length=100, verbose_name="Mã sản phẩm")
    name = models.CharField(max_length=255, verbose_name="Tên sản phẩm")
    description = models.TextField(blank=True, verbose_name="Mô tả")
    unit = models.CharField(
        max_length=20,
        choices=UNIT_CHOICES,
        default=UNIT_CAI,
        verbose_name="Đơn vị tính",
    )
    price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        verbose_name="Giá bán",
    )
    cost_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        verbose_name="Giá nhập",
    )
    image = models.ImageField(
        upload_to="products/",
        blank=True,
        null=True,
        verbose_name="Hình ảnh",
    )
    is_active = models.BooleanField(default=True, verbose_name="Đang kinh doanh")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Sản phẩm"
        verbose_name_plural = "Sản phẩm"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "sku"],
                name="unique_product_sku_per_company",
            ),
            models.CheckConstraint(
                check=models.Q(price__gte=0),
                name="product_price_gte_0",
            ),
            models.CheckConstraint(
                check=models.Q(cost_price__gte=0),
                name="product_cost_price_gte_0",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku})"


class Warehouse(models.Model):
    """Kho hàng — cô lập theo từng công ty."""

    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="warehouses",
        verbose_name="Công ty",
    )
    name = models.CharField(max_length=150, verbose_name="Tên kho")
    location = models.CharField(max_length=255, blank=True, verbose_name="Địa chỉ kho")
    is_active = models.BooleanField(default=True, verbose_name="Đang hoạt động")

    class Meta:
        verbose_name = "Kho hàng"
        verbose_name_plural = "Kho hàng"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                name="unique_warehouse_per_company",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.company.name})"


class StockLevel(models.Model):
    """Tồn kho thực tế của từng sản phẩm tại từng kho."""

    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.CASCADE,
        related_name="stock_levels",
        verbose_name="Sản phẩm",
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.CASCADE,
        related_name="stock_levels",
        verbose_name="Kho hàng",
    )
    quantity = models.IntegerField(default=0, verbose_name="Số lượng tồn kho")
    min_quantity = models.IntegerField(
        default=0,
        verbose_name="Ngưỡng cảnh báo tồn kho thấp",
    )

    class Meta:
        verbose_name = "Tồn kho"
        verbose_name_plural = "Tồn kho"
        constraints = [
            models.UniqueConstraint(
                fields=["product", "warehouse"],
                name="unique_stock_level_product_warehouse",
            ),
            models.CheckConstraint(
                check=models.Q(quantity__gte=0),
                name="stock_level_quantity_gte_0",
            ),
        ]

    def __str__(self):
        return f"{self.product.sku} @ {self.warehouse.name}: {self.quantity}"

    @property
    def is_low_stock(self):
        """True nếu tồn kho dưới ngưỡng cảnh báo."""
        return self.quantity <= self.min_quantity


class InventoryTransaction(models.Model):
    """
    Phiếu Nhập / Xuất / Điều Chỉnh Kho.
    Backend chặn cứng: type=export chỉ được tạo khi Order.status == 'approved'.
    """

    TYPE_IMPORT = "import"
    TYPE_EXPORT = "export"
    TYPE_ADJUST = "adjust"
    TYPE_CHOICES = [
        (TYPE_IMPORT, "Nhập kho"),
        (TYPE_EXPORT, "Xuất kho"),
        (TYPE_ADJUST, "Điều chỉnh"),
    ]

    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="inventory_transactions",
        verbose_name="Công ty",
    )
    transaction_code = models.CharField(
        max_length=50,
        verbose_name="Mã phiếu",
        help_text="VD: IMP-20240101-001, EXP-20240101-001",
    )
    type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        verbose_name="Loại phiếu",
        db_index=True,
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="inventory_transactions",
        verbose_name="Sản phẩm",
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.PROTECT,
        related_name="inventory_transactions",
        verbose_name="Kho hàng",
    )
    quantity = models.PositiveIntegerField(verbose_name="Số lượng")
    unit_cost = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        verbose_name="Đơn giá nhập",
        help_text="Chỉ áp dụng khi loại phiếu là Nhập kho.",
    )
    reference_order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_transactions",
        verbose_name="Đơn hàng liên kết",
        help_text="Liên kết với đơn hàng khi type=export.",
    )
    note = models.TextField(blank=True, verbose_name="Ghi chú")
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_transactions",
        verbose_name="Người tạo phiếu",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Phiếu kho"
        verbose_name_plural = "Phiếu kho"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "transaction_code"],
                name="unique_transaction_code_per_company",
            ),
            models.CheckConstraint(
                check=models.Q(quantity__gt=0),
                name="inventory_transaction_quantity_gt_0",
            ),
            models.CheckConstraint(
                check=models.Q(unit_cost__gte=0),
                name="inventory_transaction_unit_cost_gte_0",
            ),
        ]

    def __str__(self):
        return f"[{self.get_type_display()}] {self.transaction_code} — {self.product.sku} x{self.quantity}"
