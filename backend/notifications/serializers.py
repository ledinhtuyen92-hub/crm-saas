from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.full_name", read_only=True, default=None)

    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "title",
            "message",
            "link",
            "is_read",
            "sender_name",
            "created_at",
        ]
        read_only_fields = ["id", "type", "title", "message", "link", "sender_name", "created_at"]
