"""
WebSocket Consumer cho Real-time Notifications.
Mỗi user authenticated kết nối vào channel group riêng của mình.
"""
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer cho thông báo real-time.

    URL: ws://localhost:8000/ws/notifications/
    Auth: Bearer token truyền qua query string ?token=<access_token>
    """

    async def connect(self):
        """Xử lý kết nối WebSocket mới."""
        user = self.scope.get("user")

        # Kiểm tra authentication
        if not user or not user.is_authenticated:
            logger.warning("WebSocket connection rejected: unauthenticated user.")
            await self.close(code=4001)
            return

        # Tạo group name riêng cho user này
        self.group_name = f"user_{user.id}_notifications"
        self.user = user

        # Tham gia group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept()
        logger.debug("WebSocket connected: user_id=%s group=%s", user.id, self.group_name)

        # Gửi message xác nhận kết nối
        await self.send(text_data=json.dumps({
            "type": "connection_established",
            "message": f"Đã kết nối thành công. Chào {user.full_name}!",
        }))

    async def disconnect(self, close_code):
        """Xử lý ngắt kết nối."""
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )
            logger.debug(
                "WebSocket disconnected: user_id=%s code=%s",
                getattr(self, "user", {}).id if hasattr(self, "user") else "unknown",
                close_code,
            )

    async def receive(self, text_data):
        """
        Nhận message từ client (frontend).
        Hiện tại hỗ trợ: ping để giữ kết nối.
        """
        try:
            data = json.loads(text_data)
            if data.get("type") == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))
        except json.JSONDecodeError:
            pass

    async def notification_send(self, event):
        """
        Handler được gọi khi có notification mới từ channel group.
        Tên method phải khớp với event["type"] (dấu . thay bằng _).
        """
        await self.send(text_data=json.dumps({
            "type": "notification",
            "data": event["data"],
        }))
