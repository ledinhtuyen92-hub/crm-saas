import logging
from datetime import timedelta
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from production.models import ProductionOrder
from .models import DeliveryOrder, WarrantyCard

logger = logging.getLogger(__name__)


@receiver(post_save, sender=ProductionOrder)
def auto_create_delivery_order(sender, instance, created, **kwargs):
    """
    Tự động tạo lệnh giao hàng khi Lệnh sản xuất chuyển sang Hoàn thành.
    """
    if instance.status == ProductionOrder.STATUS_COMPLETED:
        # Kiểm tra xem đã có DeliveryOrder cho Order này chưa
        delivery, created_delivery = DeliveryOrder.objects.get_or_create(
            order=instance.order,
            defaults={
                "company": instance.company,
                "status": DeliveryOrder.STATUS_PENDING,
                "shipping_address": getattr(instance.order.customer, "address", "") if instance.order and instance.order.customer else "",
            }
        )
        if created_delivery:
            # Generate code
            from core.numbering import derive_code_from_source
            delivery.delivery_code = derive_code_from_source(instance.order.order_number, DeliveryOrder, "delivery_code", instance.company, "GH")
            delivery.save(update_fields=["delivery_code"])
            logger.info(f"Auto-created DeliveryOrder {delivery.delivery_code} for Order {instance.order.order_number}")
    else:
        # Nếu trạng thái không còn là Hoàn thành, tiến hành xoá lệnh giao hàng (nếu đang ở trạng thái chờ)
        deleted, _ = DeliveryOrder.objects.filter(
            order=instance.order, 
            status=DeliveryOrder.STATUS_PENDING
        ).delete()
        if deleted:
            logger.info(f"Deleted pending DeliveryOrder for Order {instance.order.order_number} due to ProductionOrder revert")


@receiver(post_save, sender=DeliveryOrder)
def handle_delivery_order_completed(sender, instance, created, **kwargs):
    """
    Tự động tạo Phiếu bảo hành và đóng Đơn hàng khi Giao hàng thành công.
    """
    if instance.status == DeliveryOrder.STATUS_DELIVERED:
        import datetime
        months = instance.order.warranty_months if hasattr(instance.order, 'warranty_months') and instance.order.warranty_months else 12
        start_date = timezone.now().date()
        
        month = start_date.month - 1 + months
        year = start_date.year + month // 12
        month = month % 12 + 1
        day = min(start_date.day, [31,
            29 if year % 4 == 0 and not year % 400 == 0 else 28,
            31,30,31,30,31,31,30,31,30,31][month-1])
        end_date = datetime.date(year, month, day)

        company_settings = getattr(instance.company, "settings", None)
        default_content = company_settings.default_warranty_content if company_settings else ""
        default_rules = company_settings.default_warranty_rules if company_settings else ""

        # 1. Tạo Phiếu bảo hành
        warranty, created_warranty = WarrantyCard.objects.get_or_create(
            order=instance.order,
            defaults={
                "company": instance.company,
                "customer": instance.order.customer,
                "status": WarrantyCard.STATUS_ACTIVE,
                "start_date": start_date,
                "end_date": end_date,
                "terms": f"Bảo hành {months} tháng kể từ ngày giao hàng.",
                "warranty_content": default_content,
                "warranty_rules": default_rules,
            }
        )
        if created_warranty:
            # Generate warranty code
            from core.numbering import derive_code_from_source
            warranty.warranty_code = derive_code_from_source(instance.order.order_number, WarrantyCard, "warranty_code", instance.company, "BH")
            warranty.save(update_fields=["warranty_code"])
            logger.info(f"Auto-created WarrantyCard {warranty.warranty_code} for Order {instance.order.order_number}")

        # 2. Cập nhật Đơn hàng -> Hoàn thành
        order = instance.order
        if order.status != "completed":
            order.status = "completed"
            order.save(update_fields=["status", "updated_at"])
            logger.info(f"Auto-completed Order {order.order_number} due to successful delivery.")
