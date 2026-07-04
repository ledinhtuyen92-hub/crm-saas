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
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(pre_save, sender="orders.Order")
def track_order_status_change(sender, instance, **kwargs):
    """
    Trước khi save, lưu lại status cũ vào _original_status
    để so sánh sau khi save.
    """
    if instance.pk:
        try:
            original = sender.objects.get(pk=instance.pk)
            instance._original_status = original.status
        except sender.DoesNotExist:
            instance._original_status = None
    else:
        instance._original_status = None


@receiver(post_save, sender="orders.Order")
def on_order_saved(sender, instance, created, **kwargs):
    """
    Sau khi save Order:
    - Nếu MỚI TẠO → thông báo cho Quản lý/Kế toán
    - Nếu STATUS THAY ĐỔI SANG 'approved' → xuất kho + tạo lệnh SX + thông báo
    - Nếu STATUS THAY ĐỔI SANG 'rejected' → thông báo cho người tạo
    """
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


@transaction.atomic
def _handle_order_approved(order):
    """
    Xử lý khi đơn hàng được duyệt:
    1. Xuất kho cho từng OrderItem
    2. Tạo ProductionOrder
    3. Gửi notification
    """
    from core.numbering import generate_transaction_code
    from inventory.models import InventoryTransaction, StockLevel, Warehouse
    from notifications.utils import notify_order_approved

    # Lấy kho mặc định của công ty
    try:
        default_warehouse = order.company.settings.default_warehouse
    except Exception:
        default_warehouse = None

    if default_warehouse is None:
        # Lấy kho đầu tiên của company nếu không có kho mặc định
        default_warehouse = Warehouse.objects.filter(
            company=order.company, is_active=True
        ).first()

    for item in order.items.select_related("product").all():
        # 1. Tạo InventoryTransaction (xuất kho)
        txn_code = generate_transaction_code(order.company, "export")
        transaction_obj = InventoryTransaction.objects.create(
            company=order.company,
            transaction_code=txn_code,
            type=InventoryTransaction.TYPE_EXPORT,
            product=item.product,
            warehouse=default_warehouse,
            quantity=item.quantity,
            unit_cost=0,
            reference_order=order,
            note=f"Xuất kho tự động cho đơn hàng {order.order_number}",
            created_by=order.approved_by,
        )

        # 2. Cập nhật StockLevel (trừ tồn kho)
        if default_warehouse:
            stock, _ = StockLevel.objects.select_for_update().get_or_create(
                product=item.product,
                warehouse=default_warehouse,
                defaults={"quantity": 0},
            )

            if stock.quantity < item.quantity:
                logger.warning(
                    "Stock insufficient for product %s: available=%s, required=%s",
                    item.product.sku,
                    stock.quantity,
                    item.quantity,
                )

            stock.quantity = max(0, stock.quantity - item.quantity)
            stock.save(update_fields=["quantity"])

            # Cảnh báo tồn kho thấp
            if stock.is_low_stock and stock.min_quantity > 0:
                try:
                    from notifications.utils import notify_inventory_low
                    notify_inventory_low(stock)
                except Exception as exc:
                    logger.warning("Low stock notification failed: %s", exc)

    # 3. Tạo ProductionOrder tự động
    _create_production_order(order)

    # 4. Thông báo cho người tạo đơn
    try:
        notify_order_approved(order)
    except Exception as exc:
        logger.error("Failed to send approved notification for order %s: %s", order.order_number, exc)


def _create_production_order(order):
    """Tự động tạo ProductionOrder sau khi đơn được duyệt."""
    try:
        from production.models import ProductionOrder

        # Kiểm tra tránh duplicate
        if not ProductionOrder.objects.filter(order=order).exists():
            ProductionOrder.objects.create(
                company=order.company,
                order=order,
                status=ProductionOrder.STATUS_PENDING,
            )
            logger.info("Auto-created ProductionOrder for order %s", order.order_number)
    except Exception as exc:
        logger.error("Failed to create ProductionOrder for order %s: %s", order.order_number, exc)


def _handle_order_rejected(order):
    """Gửi thông báo khi đơn bị từ chối."""
    try:
        from notifications.utils import notify_order_rejected
        notify_order_rejected(order)
    except Exception as exc:
        logger.error("Failed to send rejected notification for order %s: %s", order.order_number, exc)
