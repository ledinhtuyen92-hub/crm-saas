from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    """
    GET /api/notifications/
    Trả về danh sách thông báo của user đang đăng nhập, filter theo company.
    """

    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Notification.objects.filter(
            company=user.company,
            recipient=user,
        ).select_related("sender").order_by("-created_at")

        # Lọc chỉ chưa đọc nếu có query param ?unread=true
        if self.request.query_params.get("unread") == "true":
            qs = qs.filter(is_read=False)
        return qs


class NotificationMarkReadView(generics.UpdateAPIView):
    """
    PATCH /api/notifications/<id>/read/
    Đánh dấu một thông báo là đã đọc.
    """

    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["patch"]

    def get_queryset(self):
        return Notification.objects.filter(
            company=self.request.user.company,
            recipient=self.request.user,
        )

    def patch(self, request, *args, **kwargs):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notification).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def mark_all_read(request):
    """
    POST /api/notifications/mark-all-read/
    Đánh dấu tất cả thông báo của user là đã đọc.
    """
    updated_count = Notification.objects.filter(
        company=request.user.company,
        recipient=request.user,
        is_read=False,
    ).update(is_read=True)
    return Response(
        {"detail": f"Đã đánh dấu {updated_count} thông báo là đã đọc."},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def unread_count(request):
    """
    GET /api/notifications/unread-count/
    Trả về số lượng thông báo chưa đọc — dùng cho Badge trên icon Chuông.
    """
    count = Notification.objects.filter(
        company=request.user.company,
        recipient=request.user,
        is_read=False,
    ).count()
    return Response({"unread_count": count})
