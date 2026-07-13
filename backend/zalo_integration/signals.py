import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import ZaloOaConfig, ZaloMessageLog, ZaloMessageTemplate
from finance.models import PaymentReceipt
from orders.models import Order
from .tasks import send_zns_task

logger = logging.getLogger(__name__)

@receiver(post_save, sender=PaymentReceipt)
def trigger_zns_on_payment_receipt(sender, instance, created, **kwargs):
    """
    Tự động gửi ZNS khi Phiếu Thu được tạo (Hoặc chuyển sang trạng thái đã thanh toán).
    Dành cho mục đích cảm ơn khách hàng đã thanh toán.
    """
    if not created:
        return

    company = instance.company
    config = ZaloOaConfig.objects.filter(company=company, is_active=True).first()
    if not config or not config.auto_send_payment_zns:
        return

    customer = instance.customer
    if not customer or not customer.phone:
        return

    # Tìm mẫu ZNS loại 'payment_receipt' (hoặc 'care' làm fallback)
    template = ZaloMessageTemplate.objects.filter(
        company=company,
        template_type__in=[ZaloMessageTemplate.TYPE_CARE, ZaloMessageTemplate.TYPE_CUSTOM],
        is_active=True
    ).first()

    if not template:
        logger.warning(f"[Zalo Signal] Không tìm thấy mẫu ZNS cho PaymentReceipt (Company: {company.name})")
        return

    # Chuẩn bị tham số
    params = {
        "customer_name": customer.name,
        "amount": str(instance.amount),
        "receipt_code": instance.receipt_code if hasattr(instance, "receipt_code") else f"PT-{instance.id}"
    }

    # Tạo Message Log
    log = ZaloMessageLog.objects.create(
        company=company,
        template=template,
        customer=customer,
        recipient_phone=customer.phone,
        params_sent=params,
        status=ZaloMessageLog.STATUS_PENDING,
    )

    # Đẩy vào Celery queue
    send_zns_task.delay(log.id)
    logger.info(f"[Zalo Signal] Đã kích hoạt auto ZNS cho PaymentReceipt #{instance.id}")


@receiver(post_save, sender=Order)
def trigger_zns_on_order_completed(sender, instance, **kwargs):
    """
    Tự động gửi ZNS (Kèm phiếu bảo hành) khi Đơn hàng chuyển sang trạng thái Hoàn thành.
    """
    # Chỉ trigger khi status == "completed"
    if instance.status != Order.STATUS_COMPLETED:
        return

    company = instance.company
    config = ZaloOaConfig.objects.filter(company=company, is_active=True).first()
    if not config or not config.auto_send_delivery_zns:
        return

    customer = instance.customer
    if not customer or not customer.phone:
        return

    # Chống gửi nhiều lần nếu update liên tục
    # Kiểm tra xem order này đã gửi ZNS completed chưa bằng cách check log gần đây
    # Để an toàn, tạm thời ta chấp nhận gửi 1 lần khi status vừa chuyển sang completed.
    # TODO: Thêm check logic để tránh spam
    
    template = ZaloMessageTemplate.objects.filter(
        company=company,
        template_type__in=[ZaloMessageTemplate.TYPE_CARE, ZaloMessageTemplate.TYPE_ORDER_CONFIRM],
        is_active=True
    ).first()

    if not template:
        logger.warning(f"[Zalo Signal] Không tìm thấy mẫu ZNS cho Order Completed (Company: {company.name})")
        return

    params = {
        "customer_name": customer.name,
        "order_number": instance.order_number,
        "warranty_link": f"https://system.yourdomain.com/warranty/{instance.order_number}"
    }

    log = ZaloMessageLog.objects.create(
        company=company,
        template=template,
        customer=customer,
        recipient_phone=customer.phone,
        params_sent=params,
        status=ZaloMessageLog.STATUS_PENDING,
    )

    send_zns_task.delay(log.id)
    logger.info(f"[Zalo Signal] Đã kích hoạt auto ZNS cho Order Completed #{instance.id}")
