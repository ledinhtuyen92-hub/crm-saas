"""
Django Signals cho CRM app.
Kích hoạt khi Customer.assigned_to thay đổi → gửi notification cho Sale.
"""
import logging

from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(pre_save, sender="crm.Customer")
def track_customer_assignment(sender, instance, **kwargs):
    """Lưu assigned_to cũ trước khi save để phát hiện thay đổi."""
    if instance.pk:
        try:
            original = sender.objects.get(pk=instance.pk)
            instance._original_assigned_to_id = original.assigned_to_id
        except sender.DoesNotExist:
            instance._original_assigned_to_id = None
    else:
        instance._original_assigned_to_id = None


@receiver(post_save, sender="crm.Customer")
def on_customer_saved(sender, instance, created, **kwargs):
    """
    Sau khi lưu Customer:
    - Nếu MỚI TẠO và có assigned_to → gửi notification
    - Nếu CẬP NHẬT và assigned_to THAY ĐỔI → gửi notification
    """
    if not instance.assigned_to:
        return

    original_assigned_id = getattr(instance, "_original_assigned_to_id", None)

    # Chỉ gửi notification khi assigned_to thay đổi
    if instance.assigned_to_id != original_assigned_id:
        try:
            from notifications.utils import notify_customer_assigned
            assigner = getattr(instance, "_assigned_by", None)
            notify_customer_assigned(
                customer=instance,
                assigned_to=instance.assigned_to,
                assigned_by=assigner,
            )
        except Exception as exc:
            logger.error(
                "Failed to send assignment notification for customer %s: %s",
                instance.name,
                exc,
            )
