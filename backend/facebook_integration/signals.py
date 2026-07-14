"""
facebook_integration/signals.py
Tự động đồng bộ is_customer_converted khi Customer được tạo mới hoặc bị xoá.
"""

import logging
from django.db.models import Q
from django.db.models.signals import pre_delete, post_delete, post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(pre_delete, sender="crm.Customer")
def reset_facebook_lead_on_customer_delete(sender, instance, **kwargs):
    """
    Sử dụng pre_delete (trước khi SET_NULL gán customer = None trong DB)
    để tìm ra tất cả FacebookLead đang liên kết với Customer hoặc có SĐT tương ứng,
    và reset về trạng thái 'Chưa thêm KH'.
    """
    try:
        from facebook_integration.models import FacebookLead
        query = Q(customer=instance)
        if instance.phone and hasattr(instance, "company_id") and instance.company_id:
            query |= (
                Q(company_id=instance.company_id, detected_phone=instance.phone) |
                Q(page_config__company_id=instance.company_id, detected_phone=instance.phone)
            )
        elif instance.phone:
            query |= Q(detected_phone=instance.phone)

        updated = FacebookLead.objects.filter(query).update(
            is_customer_converted=False,
            customer=None,
        )
        if updated:
            logger.info(
                f"[Facebook Signal] Reset {updated} FacebookLead(s) "
                f"before Customer #{instance.id} ({instance.phone}) deletion."
            )
    except Exception as e:
        logger.error(f"[Facebook Signal] Error resetting facebook leads on customer delete: {e}")


@receiver(post_delete, sender="crm.Customer")
def reset_facebook_lead_on_customer_post_delete(sender, instance, **kwargs):
    """
    Sử dụng post_delete đảm bảo nếu sau khi xoá Khách hàng vẫn còn FacebookLead
    có cùng số điện thoại trong công ty mà không còn Khách hàng nào khác khớp SĐT, thì reset.
    """
    try:
        if not instance.phone:
            return
        from facebook_integration.models import FacebookLead
        from crm.models import Customer
        if hasattr(instance, "company_id") and instance.company_id:
            # Kiểm tra xem trong công ty còn Khách hàng nào khác có cùng SĐT này không
            if Customer.objects.filter(company_id=instance.company_id, phone=instance.phone).exists():
                return
            query = (
                Q(company_id=instance.company_id, detected_phone=instance.phone) |
                Q(page_config__company_id=instance.company_id, detected_phone=instance.phone)
            )
        else:
            query = Q(detected_phone=instance.phone)

        updated = FacebookLead.objects.filter(query).update(
            is_customer_converted=False,
            customer=None,
        )
        if updated:
            logger.info(f"[Facebook Signal post_delete] Reset {updated} FacebookLead(s) after Customer #{instance.id} deletion.")
    except Exception as e:
        logger.error(f"[Facebook Signal post_delete] Error: {e}")


@receiver(post_save, sender="crm.Customer")
def sync_facebook_lead_on_customer_save(sender, instance, created, **kwargs):
    """
    Khi một Customer được tạo mới hoặc cập nhật SĐT:
    Đồng bộ trạng thái is_customer_converted=True và gán customer cho các FacebookLead có cùng SĐT.
    """
    try:
        if not instance.phone or not hasattr(instance, "company_id") or not instance.company_id:
            return
        from facebook_integration.models import FacebookLead
        updated = FacebookLead.objects.filter(
            Q(company_id=instance.company_id, detected_phone=instance.phone) |
            Q(page_config__company_id=instance.company_id, detected_phone=instance.phone)
        ).update(
            is_customer_converted=True,
            customer=instance
        )
        if updated:
            logger.info(
                f"[Facebook Signal] Synced {updated} FacebookLead(s) "
                f"with Customer #{instance.id} ({instance.phone})."
            )
    except Exception as e:
        logger.error(f"[Facebook Signal] Error syncing facebook leads on customer save: {e}")
