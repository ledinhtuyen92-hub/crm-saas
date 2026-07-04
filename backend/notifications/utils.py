"""
Notification utility functions.
Dùng để tạo Notification record và broadcast qua WebSocket channel.
"""
import json
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification

logger = logging.getLogger(__name__)


def get_user_channel_name(user_id: int) -> str:
    """Tên channel group cho một user cụ thể."""
    return f"user_{user_id}_notifications"


def create_notification(
    *,
    company,
    recipient,
    notif_type: str,
    title: str,
    message: str,
    link: str = "",
    sender=None,
) -> Notification:
    """
    Tạo Notification trong database và broadcast ngay qua WebSocket.

    Args:
        company: Company instance
        recipient: User instance — người nhận
        notif_type: Notification.TYPE_* constant
        title: Tiêu đề thông báo
        message: Nội dung thông báo
        link: URL điều hướng khi click (optional)
        sender: User instance — người gửi (None = hệ thống tự động)

    Returns:
        Notification instance đã được lưu.
    """
    notification = Notification.objects.create(
        company=company,
        recipient=recipient,
        sender=sender,
        type=notif_type,
        title=title,
        message=message,
        link=link,
    )

    # Broadcast qua WebSocket nếu Channels đang chạy
    _broadcast_notification(notification)

    return notification


def _broadcast_notification(notification: Notification) -> None:
    """Gửi notification tới WebSocket channel của người nhận."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            logger.debug("Channel layer not configured — skipping WebSocket broadcast.")
            return

        group_name = get_user_channel_name(notification.recipient_id)
        payload = {
            "type": "notification.send",
            "data": {
                "id": notification.id,
                "type": notification.type,
                "title": notification.title,
                "message": notification.message,
                "link": notification.link,
                "is_read": notification.is_read,
                "created_at": notification.created_at.isoformat(),
            },
        }
        async_to_sync(channel_layer.group_send)(group_name, payload)
    except Exception as exc:
        # Không để lỗi WebSocket làm hỏng main request flow
        logger.warning("WebSocket broadcast failed: %s", exc)


def notify_order_pending(order, recipients):
    """
    Gửi thông báo cho Quản lý/Kế toán khi có đơn hàng mới cần duyệt.

    Args:
        order: Order instance
        recipients: QuerySet hoặc list User — người cần thông báo
    """
    for recipient in recipients:
        create_notification(
            company=order.company,
            recipient=recipient,
            notif_type=Notification.TYPE_ORDER_NEW,
            title="Đơn hàng mới cần duyệt",
            message=(
                f"Đơn hàng {order.order_number} của khách "
                f"{order.customer.name} đang chờ duyệt."
            ),
            link=f"/orders/{order.id}",
            sender=order.created_by,
        )


def notify_order_approved(order):
    """Gửi thông báo cho người tạo đơn khi đơn được duyệt."""
    if order.created_by:
        create_notification(
            company=order.company,
            recipient=order.created_by,
            notif_type=Notification.TYPE_ORDER_APPROVED,
            title="Đơn hàng đã được duyệt",
            message=(
                f"Đơn hàng {order.order_number} của khách "
                f"{order.customer.name} đã được chấp thuận."
            ),
            link=f"/orders/{order.id}",
            sender=order.approved_by,
        )


def notify_order_rejected(order):
    """Gửi thông báo cho người tạo đơn khi đơn bị từ chối."""
    if order.created_by:
        create_notification(
            company=order.company,
            recipient=order.created_by,
            notif_type=Notification.TYPE_ORDER_REJECTED,
            title="Đơn hàng bị từ chối",
            message=(
                f"Đơn hàng {order.order_number} của khách "
                f"{order.customer.name} đã bị từ chối."
            ),
            link=f"/orders/{order.id}",
            sender=order.approved_by,
        )


def notify_customer_assigned(customer, assigned_to, assigned_by=None):
    """Gửi thông báo cho Sale khi được phân công khách hàng mới."""
    create_notification(
        company=customer.company,
        recipient=assigned_to,
        notif_type=Notification.TYPE_CRM_ASSIGNED,
        title="Bạn có khách hàng mới được phân công",
        message=(
            f"Khách hàng {customer.name} ({customer.phone}) "
            f"đã được phân công cho bạn."
        ),
        link=f"/customers/{customer.id}",
        sender=assigned_by,
    )


def notify_inventory_low(stock_level):
    """Gửi thông báo cảnh báo tồn kho thấp cho Quản lý kho."""
    from users.models import User
    # Gửi cho tất cả company admin và user có quyền inventory.view
    recipients = User.objects.filter(
        company=stock_level.product.company,
        is_active=True,
    ).filter(
        models_Q := __import__("django.db.models", fromlist=["Q"]).Q(is_company_admin=True)
        | __import__("django.db.models", fromlist=["Q"]).Q(role__permissions__code="inventory.view")
    ).distinct()

    for recipient in recipients:
        create_notification(
            company=stock_level.product.company,
            recipient=recipient,
            notif_type=Notification.TYPE_INVENTORY_LOW,
            title="Cảnh báo tồn kho thấp",
            message=(
                f"Sản phẩm {stock_level.product.name} ({stock_level.product.sku}) "
                f"tại kho {stock_level.warehouse.name} chỉ còn "
                f"{stock_level.quantity} {stock_level.product.unit} "
                f"(ngưỡng cảnh báo: {stock_level.min_quantity})."
            ),
            link=f"/inventory/products/{stock_level.product.id}",
        )
