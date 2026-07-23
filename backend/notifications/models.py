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


class InternalAnnouncement(models.Model):
    """Thông báo nội bộ (bản tin, tài liệu công ty)."""
    
    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="announcements",
        verbose_name="Công ty",
    )
    title = models.CharField(max_length=255, verbose_name="Tiêu đề")
    content = models.TextField(verbose_name="Nội dung")
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_announcements",
        verbose_name="Người tạo",
    )
    is_all_company = models.BooleanField(
        default=True, 
        verbose_name="Gửi toàn công ty"
    )
    departments = models.ManyToManyField(
        "users.Department",
        blank=True,
        related_name="announcements",
        verbose_name="Phòng ban nhận",
    )
    target_users = models.ManyToManyField(
        "users.User",
        blank=True,
        related_name="targeted_announcements",
        verbose_name="Nhân viên nhận",
    )
    priority = models.CharField(
        max_length=20,
        choices=[("low", "Thấp"), ("normal", "Thường"), ("high", "Cao")],
        default="normal",
        verbose_name="Độ ưu tiên",
    )
    category = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Loại thông báo"
    )
    is_pinned = models.BooleanField(
        default=False,
        verbose_name="Đã ghim",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Thông báo nội bộ"
        verbose_name_plural = "Thông báo nội bộ"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "created_at"]),
        ]

    def __str__(self):
        return self.title


class AnnouncementCategory(models.Model):
    """Bảng lưu trữ danh mục loại thông báo nội bộ."""
    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="announcement_categories",
        verbose_name="Công ty",
    )
    name = models.CharField(max_length=255, verbose_name="Tên loại thông báo")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Loại thông báo nội bộ"
        verbose_name_plural = "Loại thông báo nội bộ"
        unique_together = ("company", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.company.name})"


class AnnouncementAttachment(models.Model):
    """File đính kèm của thông báo nội bộ."""
    
    announcement = models.ForeignKey(
        InternalAnnouncement,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField(upload_to="announcements/", verbose_name="File đính kèm")
    file_name = models.CharField(max_length=255, verbose_name="Tên file")
    file_size = models.IntegerField(verbose_name="Kích thước (bytes)", default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "File đính kèm thông báo"
        verbose_name_plural = "File đính kèm thông báo"

    def __str__(self):
        return self.file_name


class AnnouncementRead(models.Model):
    """Lưu trạng thái đã đọc thông báo của nhân viên."""
    
    announcement = models.ForeignKey(
        InternalAnnouncement,
        on_delete=models.CASCADE,
        related_name="reads",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="read_announcements_status",
    )
    read_at = models.DateTimeField(auto_now_add=True, verbose_name="Thời gian đọc")

    class Meta:
        verbose_name = "Trạng thái đọc thông báo"
        verbose_name_plural = "Trạng thái đọc thông báo"
        unique_together = ("announcement", "user")

    def __str__(self):
        return f"{self.user.full_name} read {self.announcement.title}"
