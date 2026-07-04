from django.db import models


class Notification(models.Model):
    """Thông báo real-time — gửi qua WebSocket (Django Channels)."""

    TYPE_ORDER_NEW = "order_new"
    TYPE_ORDER_APPROVED = "order_approved"
    TYPE_ORDER_REJECTED = "order_rejected"
    TYPE_CRM_ASSIGNED = "crm_assigned"
    TYPE_SYSTEM_UPDATE = "system_update"
    TYPE_INVENTORY_LOW = "inventory_low"
    TYPE_CHOICES = [
        (TYPE_ORDER_NEW, "Đơn hàng mới cần duyệt"),
        (TYPE_ORDER_APPROVED, "Đơn hàng đã được duyệt"),
        (TYPE_ORDER_REJECTED, "Đơn hàng bị từ chối"),
        (TYPE_CRM_ASSIGNED, "Được phân công khách hàng mới"),
        (TYPE_SYSTEM_UPDATE, "Cập nhật từ hệ thống"),
        (TYPE_INVENTORY_LOW, "Cảnh báo tồn kho thấp"),
    ]

    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="Công ty",
    )
    recipient = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="Người nhận",
    )
    sender = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_notifications",
        verbose_name="Người gửi",
        help_text="Để trống nếu là thông báo tự động từ hệ thống.",
    )
    type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
        verbose_name="Loại thông báo",
        db_index=True,
    )
    title = models.CharField(max_length=255, verbose_name="Tiêu đề")
    message = models.TextField(verbose_name="Nội dung")
    link = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Liên kết điều hướng",
        help_text="URL điều hướng khi click vào thông báo. VD: /orders/123",
    )
    is_read = models.BooleanField(default=False, verbose_name="Đã đọc", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Thông báo"
        verbose_name_plural = "Thông báo"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["company", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.get_type_display()}] → {self.recipient.full_name}: {self.title}"
