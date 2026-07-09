from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class ApprovalRequest(models.Model):
    """
    Yêu cầu phê duyệt tập trung, có thể gắn vào bất kỳ đối tượng nào (Đơn hàng, Báo giá, Kho...).
    """
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CANCELED = "canceled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Chờ duyệt"),
        (STATUS_APPROVED, "Đã duyệt"),
        (STATUS_REJECTED, "Từ chối"),
        (STATUS_CANCELED, "Đã hủy"),
    ]

    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="approval_requests",
        verbose_name="Công ty",
    )
    
    # Generic Relations để link tới Order, Quotation, InventoryTransaction...
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")
    
    requester = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="approval_requests",
        verbose_name="Người yêu cầu",
    )
    title = models.CharField(max_length=255, verbose_name="Tiêu đề yêu cầu")
    description = models.TextField(blank=True, verbose_name="Mô tả / Ghi chú")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name="Trạng thái",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Yêu cầu phê duyệt"
        verbose_name_plural = "Yêu cầu phê duyệt"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
        ]

    def __str__(self):
        return f"{self.title} - {self.get_status_display()}"


class ApprovalStep(models.Model):
    """
    Các bước duyệt của một Yêu cầu phê duyệt. 
    Hỗ trợ duyệt nhiều cấp (Cấp 1, Cấp 2...).
    """
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Chờ duyệt"),
        (STATUS_APPROVED, "Đồng ý"),
        (STATUS_REJECTED, "Từ chối"),
    ]

    request = models.ForeignKey(
        ApprovalRequest,
        on_delete=models.CASCADE,
        related_name="steps",
        verbose_name="Yêu cầu",
    )
    step_order = models.PositiveIntegerField(default=1, verbose_name="Thứ tự duyệt (Cấp)")
    
    # Người duyệt có thể là một User cụ thể hoặc bất kỳ ai có Role cụ thể
    approver_user = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approval_tasks",
        verbose_name="Người duyệt chỉ định",
    )
    approver_role = models.ForeignKey(
        "users.Role",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approval_tasks",
        verbose_name="Vai trò duyệt (bất kỳ ai có role này)",
    )
    
    acted_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="acted_approval_steps",
        verbose_name="Người thực tế duyệt",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name="Trạng thái bước này",
    )
    comment = models.TextField(blank=True, verbose_name="Ý kiến phản hồi")
    comments = models.TextField(blank=True, verbose_name="Ý kiến phản hồi")
    acted_at = models.DateTimeField(null=True, blank=True, verbose_name="Thời gian thực hiện")

    class Meta:
        verbose_name = "Bước phê duyệt"
        verbose_name_plural = "Bước phê duyệt"
        ordering = ["request", "step_order"]

    def __str__(self):
        return f"{self.request.title} - Cấp {self.step_order}"
