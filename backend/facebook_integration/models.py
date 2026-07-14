"""
facebook_integration/models.py
Models cho module Facebook Multi-Page Inbox.
"""

from django.db import models
from django.utils import timezone


# ── Model 1: Cấu hình kết nối Trang Facebook (Fanpage) ───────────────────────

class FacebookPageConfig(models.Model):
    """
    Lưu thông tin kết nối cho mỗi Trang Facebook (Fanpage) của Công ty.
    Mỗi công ty có thể kết nối nhiều trang (Multi-Page).
    """

    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="facebook_page_configs",
        verbose_name="Công ty",
    )
    page_name = models.CharField(
        max_length=255,
        verbose_name="Tên Trang Facebook",
        help_text="Tên hiển thị của Fanpage trên Facebook.",
    )
    page_id = models.CharField(
        max_length=100,
        verbose_name="Page ID",
        help_text="ID của Fanpage Facebook (lấy từ trang Meta Developers).",
    )
    page_access_token = models.TextField(
        blank=True,
        null=True,
        verbose_name="Page Access Token",
        help_text="Token dài hạn (Long-Lived Page Access Token) để gửi/nhận tin nhắn.",
    )
    webhook_verify_token = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Webhook Verify Token",
        help_text="Mã xác thực webhook tùy chỉnh – khai báo trên Meta Developers.",
    )
    page_avatar = models.URLField(
        blank=True,
        null=True,
        verbose_name="Avatar Trang Facebook",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Đang kết nối",
    )
    auto_create_customer_from_phone = models.BooleanField(
        default=False,
        verbose_name="Tự động tạo KH khi phát hiện SĐT",
        help_text="Tự động tạo hồ sơ Khách hàng vào CRM khi nhận diện được SĐT trong hội thoại.",
    )
    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="facebook_pages_managed",
        verbose_name="Nhân viên phụ trách mặc định",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Cấu hình Trang Facebook"
        verbose_name_plural = "Cấu hình Trang Facebook"
        unique_together = [("company", "page_id")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.page_name} ({self.page_id})"

    @property
    def is_token_valid(self):
        """Token hợp lệ nếu page_access_token không rỗng."""
        return bool(self.page_access_token)


# ── Model 2: Hội thoại Khách hàng trên Facebook ──────────────────────────────

class FacebookLead(models.Model):
    """
    Đại diện cho mỗi người dùng Facebook đã nhắn tin vào Trang.
    Mỗi Lead tương ứng 1 PSID (Page-Scoped User ID) trên từng Trang.
    """

    STATUS_CHOICES = [
        ("not_added", "Chưa thêm KH"),
        ("converted", "Đã có trong KH"),
    ]

    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="facebook_leads",
        verbose_name="Công ty",
    )
    page_config = models.ForeignKey(
        FacebookPageConfig,
        on_delete=models.CASCADE,
        related_name="leads",
        verbose_name="Trang Facebook",
    )
    fb_user_id = models.CharField(
        max_length=100,
        verbose_name="Facebook User ID (PSID)",
    )
    fb_user_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Tên người dùng Facebook",
    )
    fb_user_avatar = models.URLField(
        blank=True,
        null=True,
        verbose_name="Avatar Facebook",
    )
    detected_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name="SĐT đã phát hiện",
    )
    is_customer_converted = models.BooleanField(
        default=False,
        verbose_name="Đã có trong hệ thống KH",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="facebook_leads",
        verbose_name="Khách hàng CRM liên kết",
    )
    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="facebook_leads_assigned",
        verbose_name="Nhân viên phụ trách",
    )
    last_message_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Thời điểm tin nhắn cuối",
    )
    last_message_preview = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Nội dung tin nhắn cuối (tóm tắt)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Hội thoại Facebook"
        verbose_name_plural = "Hội thoại Facebook"
        unique_together = [("page_config", "fb_user_id")]
        ordering = ["-last_message_at"]

    def __str__(self):
        return f"{self.fb_user_name or self.fb_user_id} @ {self.page_config.page_name}"

    @property
    def status(self):
        if self.is_customer_converted:
            return "converted"
        return "not_added"


# ── Model 3: Tin nhắn 2 chiều Facebook ───────────────────────────────────────

class FacebookMessage(models.Model):
    """
    Lưu từng tin nhắn trong hội thoại giữa Khách hàng và Trang Facebook.
    """

    SENDER_CHOICES = [
        ("customer", "Khách hàng"),
        ("page", "Trang Facebook (Admin)"),
    ]

    lead = models.ForeignKey(
        FacebookLead,
        on_delete=models.CASCADE,
        related_name="messages",
        verbose_name="Hội thoại",
    )
    fb_message_id = models.CharField(
        max_length=100,
        unique=True,
        blank=True,
        null=True,
        verbose_name="Facebook Message ID",
    )
    sender_type = models.CharField(
        max_length=20,
        choices=SENDER_CHOICES,
        default="customer",
        verbose_name="Người gửi",
    )
    text = models.TextField(
        blank=True,
        verbose_name="Nội dung văn bản",
    )
    attachment_url = models.URLField(
        blank=True,
        null=True,
        verbose_name="Đính kèm (URL ảnh/file)",
    )
    attachment_type = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Loại đính kèm (image, file, sticker...)",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Tin nhắn Facebook"
        verbose_name_plural = "Tin nhắn Facebook"
        ordering = ["created_at"]

    def __str__(self):
        preview = (self.text or "[Đính kèm]")[:40]
        return f"[{self.sender_type}] {preview}"
