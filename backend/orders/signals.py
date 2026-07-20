"""
Django Signals cho Orders app.
Kích hoạt khi Order.status thay đổi sang 'approved':
  1. Tự động xuất kho (InventoryTransaction) cho mỗi OrderItem
  2. Tự động tạo ProductionOrder
  3. Gửi notification cho người tạo đơn
  4. Gửi notification cho Quản lý khi có đơn mới cần duyệt
"""
import logging

from django.db import transaction
from django.db.models.signals import post_save, pre_save, post_delete
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(pre_save, sender="orders.Order")
def track_order_status_change(sender, instance, **kwargs):
    """
    Trước khi save, lưu lại status cũ vào _original_status
    để so sánh sau khi save.
    """
    if kwargs.get('raw'):
        return
    if instance.pk:
        try:
            original = sender.objects.get(pk=instance.pk)
            instance._original_status = original.status
        except sender.DoesNotExist:
            instance._original_status = None
    else:
        instance._original_status = None


@receiver(post_delete, sender="orders.Order")
def on_order_deleted(sender, instance, **kwargs):
    """
    Khi xóa đơn hàng, cần đồng bộ lại trạng thái Khách hàng
    """
    sync_customer_pipeline_status(instance.customer)


@receiver(post_save, sender="orders.Order")
def on_order_saved(sender, instance, created, **kwargs):
    """
    Sau khi save Order:
    - Nếu MỚI TẠO → thông báo cho Quản lý/Kế toán
    - Nếu STATUS THAY ĐỔI SANG 'approved' → xuất kho + tạo lệnh SX + thông báo
    - Nếu STATUS THAY ĐỔI SANG 'rejected' → thông báo cho người tạo
    """
    if kwargs.get('raw'):
        return
    from orders.models import Order

    if created:
        # Đơn hàng mới → thông báo cho Quản lý/Kế toán
        _notify_managers_new_order(instance)
        return

    original_status = getattr(instance, "_original_status", None)
    if original_status == instance.status:
        # Không có thay đổi status
        return

    if instance.status == Order.STATUS_APPROVED:
        _handle_order_approved(instance)
    elif instance.status == Order.STATUS_REJECTED:
        _handle_order_rejected(instance)
    elif instance.status == Order.STATUS_CANCELLED:
        _handle_order_cancelled(instance)

    # Nếu đơn hàng bị mất trạng thái approved (ví dụ: chuyển sang canceled, draft), đồng bộ lại Khách hàng
    if original_status == Order.STATUS_APPROVED and instance.status != Order.STATUS_APPROVED:
        sync_customer_pipeline_status(instance.customer)


def _notify_managers_new_order(order):
    """Gửi thông báo cho Quản lý và Kế toán khi có đơn hàng mới."""
    try:
        from users.models import User
        from notifications.utils import notify_order_pending
        from django.db.models import Q

        # Lấy users có quyền approve hoặc là company admin
        recipients = User.objects.filter(
            company=order.company,
            is_active=True,
        ).filter(
            Q(is_company_admin=True)
            | Q(role__permissions__code="orders.approve")
        ).exclude(
            id=order.created_by_id  # Không gửi cho chính người tạo
        ).distinct()

        notify_order_pending(order, recipients)
    except Exception as exc:
        logger.error("Failed to notify managers for new order %s: %s", order.order_number, exc)

def sync_customer_pipeline_status(customer):
    """
    Đồng bộ lại trạng thái Khách hàng (Pipeline) dựa trên số lượng đơn hàng đã duyệt.
    """
    if not customer:
        return
    try:
        from orders.models import Order
        from crm.models import Customer
        approved_count = customer.orders.filter(status=Order.STATUS_APPROVED).count()
        
        # Nếu có từ 2 đơn trở lên -> Khách hàng quay lại (Mua thêm)
        if approved_count >= 2:
            if customer.status != Customer.STATUS_REPEAT_ORDER:
                customer.status = Customer.STATUS_REPEAT_ORDER
                customer.save(update_fields=['status'])
        # Nếu mới có 1 đơn -> Khách hàng mới chốt (Đã có đơn hàng)
        elif approved_count == 1:
            if customer.status != Customer.STATUS_HAS_ORDER:
                customer.status = Customer.STATUS_HAS_ORDER
                customer.save(update_fields=['status'])
        else:
            # approved_count == 0
            # Chỉ lùi trạng thái về 'Đang hoạt động' nếu khách hàng đang bị đánh dấu là đã có đơn hàng
            if customer.status in [Customer.STATUS_HAS_ORDER, Customer.STATUS_REPEAT_ORDER]:
                customer.status = Customer.STATUS_ACTIVE
                customer.save(update_fields=['status'])
    except Exception as exc:
        logger.error("Failed to sync customer pipeline status for customer %s: %s", customer.id, exc)


@transaction.atomic
def _handle_order_approved(order):
    """
    Xử lý khi đơn hàng được duyệt:
    1. Xuất kho cho từng OrderItem
    2. Tạo ProductionOrder
    3. Gửi notification
    """
    # Tự động tạo Lệnh xuất kho chờ duyệt và Lệnh sản xuất nếu đủ điều kiện tài chính
    check_and_trigger_mo_gate(order)

    # 4. Thông báo cho người tạo đơn
    try:
        notify_order_approved(order)
    except Exception as exc:
        logger.error("Failed to send approved notification for order %s: %s", order.order_number, exc)

    # 5. Tự động chuyển trạng thái Khách hàng (Pipeline)
    sync_customer_pipeline_status(order.customer)

def check_and_trigger_mo_gate(order):
    """Cổng kiểm soát MO: Chỉ khởi tạo lệnh sản xuất khi đơn đã cọc hoặc thanh toán đủ hoặc được duyệt ngoại lệ."""
    if order.status != order.STATUS_APPROVED:
        return
    allowed_statuses = [
        order.FIN_STATUS_DEPOSIT_PAID,
        order.FIN_STATUS_FULLY_PAID,
        order.FIN_STATUS_CREDIT_APPROVED,
    ]
    if order.financial_status in allowed_statuses:
        _create_production_order(order)
        _create_pending_inventory_export(order)
    else:
        logger.info("Order %s approved but waiting for deposit payment to open MO & Export Gate.", order.order_number)


def _create_production_order(order):
    """Tự động tạo ProductionOrder sau khi đơn được duyệt."""
    try:
        from production.models import ProductionOrder
        from core.numbering import derive_code_from_source

        # Kiểm tra tránh duplicate
        if not ProductionOrder.objects.filter(order=order).exists():
            po_code = derive_code_from_source(order.order_number, ProductionOrder, "production_order_code", order.company, "LSX")
            ProductionOrder.objects.create(
                company=order.company,
                order=order,
                production_order_code=po_code,
                status=ProductionOrder.STATUS_PENDING,
            )
            logger.info("Auto-created ProductionOrder for order %s", order.order_number)
    except Exception as exc:
        logger.error("Failed to create ProductionOrder for order %s: %s", order.order_number, exc)


def _create_pending_inventory_export(order):
    """Tạo lệnh xuất kho ở trạng thái chờ duyệt (pending) khi đủ điều kiện tài chính."""
    try:
        from core.numbering import generate_transaction_code
        from inventory.models import InventoryTransaction

        txn_code = None

        for item in order.items.select_related("product").all():
            # Kiểm tra xem đã tạo lệnh pending hoặc completed cho item này chưa (bỏ qua các lệnh đã bị từ chối)
            if InventoryTransaction.objects.filter(
                reference_order=order, product=item.product, type=InventoryTransaction.TYPE_EXPORT
            ).exclude(status=InventoryTransaction.STATUS_REJECTED).exists():
                continue

            if not txn_code:
                existing_txn = InventoryTransaction.objects.filter(reference_order=order, type=InventoryTransaction.TYPE_EXPORT).first()
                if existing_txn:
                    txn_code = existing_txn.transaction_code
                else:
                    txn_code = generate_transaction_code(order.company, "export")

            InventoryTransaction.objects.create(
                company=order.company,
                transaction_code=txn_code,
                type=InventoryTransaction.TYPE_EXPORT,
                status=InventoryTransaction.STATUS_PENDING,
                product=item.product,
                warehouse=None,  # Chờ thủ kho chọn
                quantity=item.quantity,
                unit_cost=0,
                reference_order=order,
                note=f"Lệnh xuất kho chờ duyệt cho đơn hàng {order.order_number}",
                created_by=order.approved_by,
            )
        logger.info("Auto-created pending InventoryTransaction(s) for order %s", order.order_number)
    except Exception as exc:
        logger.error("Failed to create pending InventoryTransaction for order %s: %s", order.order_number, exc)


def _handle_order_rejected(order):
    """Gửi thông báo khi đơn bị từ chối."""
    try:
        from notifications.utils import notify_order_rejected
        notify_order_rejected(order)
    except Exception as exc:
        logger.error("Failed to send rejected notification for order %s: %s", order.order_number, exc)


def _handle_order_cancelled(order):
    """
    Xử lý khi đơn hàng bị HỦY (Cancelled):
    1. Hủy Lệnh sản xuất (nếu chưa hoàn thành)
    2. Hủy Lệnh xuất kho (nếu chưa hoàn thành)
    """
    try:
        from production.models import ProductionOrder
        from inventory.models import InventoryTransaction

        # 1. Hủy lệnh sản xuất chưa hoàn thành
        ProductionOrder.objects.filter(
            order=order
        ).exclude(
            status=ProductionOrder.STATUS_COMPLETED
        ).update(status=ProductionOrder.STATUS_CANCELLED)
        
        # 2. Hủy các lệnh xuất kho chờ duyệt
        InventoryTransaction.objects.filter(
            reference_order=order,
            status=InventoryTransaction.STATUS_PENDING,
            type=InventoryTransaction.TYPE_EXPORT
        ).update(status=InventoryTransaction.STATUS_REJECTED)
        
        logger.info("Successfully cancelled related MO and Export transactions for cancelled order %s", order.order_number)
    except Exception as exc:
        logger.error("Failed to cancel related transactions for order %s: %s", order.order_number, exc)
