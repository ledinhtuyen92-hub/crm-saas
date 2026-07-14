"""
facebook_integration/signals.py
Tự động cập nhật is_customer_converted khi Customer bị xoá.
"""

import logging

from django.db.models.signals import post_delete
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_delete, sender="crm.Customer")
def reset_facebook_lead_on_customer_delete(sender, instance, **kwargs):
    """
    Khi một Customer bị xoá, tự động reset tất cả FacebookLead
    đang liên kết với Customer hoặc có SĐT tương ứng về trạng thái 'Chưa thêm KH'.
    """
    try:
        from facebook_integration.models import FacebookLead
        from django.db.models import Q
        query = Q(customer=instance)
        if instance.phone:
            query |= Q(detected_phone=instance.phone)
        updated = FacebookLead.objects.filter(query).update(
            is_customer_converted=False,
            customer=None,
        )
        if updated:
            logger.info(
                f"[Facebook Signal] Reset {updated} FacebookLead(s) "
                f"after Customer #{instance.id} was deleted."
            )
    except Exception as e:
        logger.error(f"[Facebook Signal] Error resetting facebook leads: {e}")
