from rest_framework import serializers

from .models import Notification, InternalAnnouncement, AnnouncementAttachment, AnnouncementRead

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


class AnnouncementAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementAttachment
        fields = ["id", "file", "file_name", "file_size", "created_at"]
        read_only_fields = ["id", "file_name", "file_size", "created_at"]


class InternalAnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    created_by_avatar = serializers.ImageField(source="created_by.avatar", read_only=True)
    attachments = AnnouncementAttachmentSerializer(many=True, read_only=True)
    read_count = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = InternalAnnouncement
        fields = [
            "id",
            "title",
            "content",
            "is_all_company",
            "departments",
            "target_users",
            "priority",
            "category",
            "is_pinned",
            "created_by",
            "created_by_name",
            "created_by_avatar",
            "attachments",
            "created_at",
            "read_count",
            "is_read",
        ]
        read_only_fields = ["id", "created_at", "created_by"]

    def get_read_count(self, obj):
        # We can optimize this using annotations if needed, but for now simple count is fine
        return obj.reads.count()

    def get_is_read(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            # We can also use annotations to avoid N+1 query: 
            # queryset.annotate(is_read=Exists(AnnouncementRead.objects.filter(announcement=OuterRef('pk'), user=request.user)))
            # But if passed via context from an annotated queryset, use it
            if hasattr(obj, "is_read_annotated"):
                return obj.is_read_annotated
            return obj.reads.filter(user=request.user).exists()
        return False
