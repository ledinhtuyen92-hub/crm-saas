"""
facebook_integration/views.py
API Views cho module Facebook Multi-Page Inbox.
"""

import logging
import uuid
from django.core.files.storage import default_storage

from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    FacebookLead, FacebookMessage, FacebookPageConfig, QuickMediaAsset,
    FacebookLeadTag, FacebookLeadNote, FacebookQuickReply,
)
from .serializers import (
    FacebookLeadListSerializer,
    FacebookLeadSerializer,
    FacebookMessageSerializer,
    FacebookPageConfigSerializer,
    QuickMediaAssetSerializer,
    FacebookLeadTagSerializer,
    FacebookLeadNoteSerializer,
    FacebookQuickReplySerializer,
)
from .services import (
    convert_facebook_lead,
    debug_facebook_token,
    exchange_oauth_code_for_token,
    extract_and_process_phone_fb,
    get_managed_pages,
    process_fb_webhook_message,
    send_facebook_message,
    smart_extract_vn_phone,
    subscribe_app_to_page,
    sync_page_conversations_history,
)

logger = logging.getLogger(__name__)


# ── Permission check helper ───────────────────────────────────────────────────

def check_facebook_module(company):
    """Kiểm tra công ty có được bật module Facebook không."""
    return getattr(company, "enable_facebook_integration", True)


# ── ViewSet: FacebookPageConfig ───────────────────────────────────────────────

class FacebookPageConfigViewSet(viewsets.ModelViewSet):
    """
    CRUD cấu hình Trang Facebook (Multi-Page).
    Yêu cầu quyền: facebook.manage_config
    """
    serializer_class = FacebookPageConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FacebookPageConfig.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        company = self.request.user.company
        if not check_facebook_module(company):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Module Facebook chưa được kích hoạt cho công ty của bạn.")
        serializer.save(company=company)

    @action(detail=True, methods=["post"], url_path="verify-token")
    def verify_token(self, request, pk=None):
        """Kiểm tra Page Access Token có hợp lệ không thông qua Graph API /me."""
        config = self.get_object()
        if not config.page_access_token:
            return Response({"error": "Chưa có Page Access Token."}, status=status.HTTP_400_BAD_REQUEST)

        import requests as req
        url = f"https://graph.facebook.com/v25.0/me"
        params = {"access_token": config.page_access_token, "fields": "id,name"}
        try:
            resp = req.get(url, params=params, timeout=8)
            data = resp.json()
            if "error" in data:
                return Response(
                    {"error": data["error"].get("message", "Token không hợp lệ.")},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Cập nhật page_id và page_name từ Graph API
            config.page_id = data.get("id", config.page_id)
            config.page_name = data.get("name", config.page_name)
            config.save(update_fields=["page_id", "page_name"])
            return Response({
                "detail": f"Token hợp lệ! Trang Facebook: {config.page_name} (ID: {config.page_id})",
                "data": FacebookPageConfigSerializer(config).data,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="debug-token")
    def debug_token(self, request, pk=None):
        """
        Dùng /debug_token để kiểm tra chi tiết thông tin token:
        thời hạn, loại token (PAGE/USER), danh sách quyền.
        """
        config = self.get_object()
        if not config.page_access_token:
            return Response({"error": "Chưa có Page Access Token."}, status=status.HTTP_400_BAD_REQUEST)

        app_id = config.get_app_id()
        app_secret = config.get_app_secret()
        if not app_id or not app_secret:
            return Response(
                {"error": "Chưa cấu hình App ID / App Secret. Vui lòng cấu hình trước."},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = debug_facebook_token(app_id, app_secret, config.page_access_token)
        if not result.get("success"):
            return Response({"error": result.get("error")}, status=status.HTTP_400_BAD_REQUEST)

        # Cập nhật token_expires_at nếu có thông tin từ Meta
        expires_at_unix = result.get("expires_at", 0)
        if expires_at_unix and expires_at_unix > 0:
            from django.utils import timezone
            import datetime
            config.token_expires_at = timezone.datetime.fromtimestamp(
                expires_at_unix, tz=timezone.utc
            )
        else:
            config.token_expires_at = None  # Page Token: không hết hạn
        config.save(update_fields=["token_expires_at"])

        return Response({
            "is_valid": result["is_valid"],
            "token_type": result["type"],
            "expires_at_unix": expires_at_unix,
            "token_expires_at_display": FacebookPageConfigSerializer(config).data.get("token_expires_at_display"),
            "scopes": result["scopes"],
            "app_id": result["app_id"],
            "is_token_near_expiry": config.is_token_near_expiry,
        })

    @action(detail=False, methods=["post"], url_path="exchange-oauth-code")
    def exchange_oauth_code(self, request):
        """
        Nhận Authorization Code từ Frontend,
        đổi lấy User Access Token → lấy danh sách Trang Facebook quản lý.
        Trả về list các trang để user chọn trang muốn kết nối.
        """
        config_id = request.data.get("config_id")
        code = request.data.get("code")
        redirect_uri = request.data.get("redirect_uri")
        
        if not code or not redirect_uri:
            return Response({"error": "Thiếu code hoặc redirect_uri từ Facebook Login."}, status=status.HTTP_400_BAD_REQUEST)

        # Lấy config
        if config_id:
            config = FacebookPageConfig.objects.filter(
                company=request.user.company, id=config_id
            ).first()
        else:
            config = FacebookPageConfig.objects.filter(
                company=request.user.company
            ).order_by("-id").first()

        if not config:
            return Response({"error": "Chưa có cấu hình Facebook nào. Hãy tạo trước."}, status=status.HTTP_400_BAD_REQUEST)

        app_id = config.get_app_id()
        app_secret = config.get_app_secret()
        if not app_id or not app_secret:
            return Response(
                {"error": "Chưa cấu hình App ID/Secret. Vui lòng nhập hoặc dùng cấu hình hệ thống."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Đổi authorization code → user token
        exchange_result = exchange_oauth_code_for_token(app_id, app_secret, code, redirect_uri)
        if not exchange_result.get("success"):
            return Response({"error": exchange_result.get("error")}, status=status.HTTP_400_BAD_REQUEST)

        long_lived_token = exchange_result["access_token"]

        # 2. Lấy danh sách Trang Facebook user quản lý
        pages = get_managed_pages(long_lived_token)
        if not pages:
            return Response(
                {"error": "Không tìm thấy Trang Facebook nào. Tài khoản này có thể không quản lý trang nào."},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            "detail": f"Đăng nhập thành công! Tìm thấy {len(pages)} Trang Facebook.",
            "pages": pages,
            "config_id": config.id,
        })

    @action(detail=True, methods=["post"], url_path="select-page")
    def select_page(self, request, pk=None):
        """
        Sau khi user chọn trang từ danh sách /exchange-oauth-code,
        lưu Page Access Token (long-lived, không hết hạn) vào config.
        """
        config = self.get_object()
        page_id = request.data.get("page_id")
        page_name = request.data.get("page_name", "")
        page_access_token = request.data.get("access_token")
        page_avatar = request.data.get("picture", {})
        if isinstance(page_avatar, dict):
            page_avatar = page_avatar.get("data", {}).get("url", "")

        if not page_id or not page_access_token:
            return Response({"error": "Thiếu page_id hoặc access_token."}, status=status.HTTP_400_BAD_REQUEST)

        config.page_id = page_id
        config.page_name = page_name or config.page_name
        config.page_access_token = page_access_token
        config.page_avatar = page_avatar or ""
        config.token_expires_at = None  # Page Access Token từ OAuth = vĩnh viễn
        config.save(update_fields=["page_id", "page_name", "page_access_token", "page_avatar", "token_expires_at"])

        # TỰ ĐỘNG ĐĂNG KÝ APP VÀO PAGE (Subscribe)
        sub_res = subscribe_app_to_page(page_id, page_access_token)
        if not sub_res.get("success"):
            logger.warning(f"Could not auto-subscribe app to page {page_id}: {sub_res.get('error')}")

        return Response({
            "detail": f"Đã kết nối Trang Facebook: {config.page_name} (ID: {config.page_id}) thành công!",
            "data": FacebookPageConfigSerializer(config).data,
        })

    @action(detail=True, methods=["post"], url_path="sync-history")
    def sync_history(self, request, pk=None):
        """
        Đồng bộ lịch sử hội thoại và tin nhắn từ Facebook Graph API.
        Nhận tham số max_conversations, limit_messages từ request.
        """
        config = self.get_object()
        if not config.page_access_token or not config.page_id:
            return Response(
                {"error": "Trang Facebook chưa được kết nối Page Access Token hợp lệ."},
                status=status.HTTP_400_BAD_REQUEST
            )

        max_conversations = int(request.data.get("max_conversations", 100))
        limit_messages = int(request.data.get("limit_messages", 50))

        try:
            res = sync_page_conversations_history(config, max_conversations=max_conversations, limit_messages=limit_messages)
            return Response({
                "detail": f"Đã đồng bộ thành công {res['synced_conversations']} hội thoại và {res['synced_messages']} tin nhắn cho Trang {config.page_name}.",
                "data": res
            })
        except Exception as e:
            logger.error(f"[SyncHistory Action] Lỗi: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def perform_destroy(self, instance):
        """Soft delete: Ngắt kết nối Trang (is_active=False) để giữ an toàn toàn bộ lịch sử hội thoại/tin nhắn."""
        instance.is_active = False
        instance.page_access_token = ""
        instance.save(update_fields=["is_active", "page_access_token", "updated_at"])

    @action(detail=True, methods=["delete", "post"], url_path="permanent-delete")
    def permanent_delete(self, request, pk=None):
        """Xóa vĩnh viễn Trang và toàn bộ hội thoại/tin nhắn liên quan (chỉ dùng khi thực sự cần)."""
        instance = self.get_object()
        page_name = instance.page_name
        leads_count = instance.leads.count()
        instance.delete()
        return Response({
            "detail": f"Đã xóa vĩnh viễn Trang {page_name} và {leads_count} hội thoại liên quan."
        })

    @action(detail=True, methods=["post"], url_path="reconnect")
    def reconnect(self, request, pk=None):
        """Khôi phục trạng thái hoạt động cho Trang (is_active=True)."""
        instance = self.get_object()
        instance.is_active = True
        instance.save(update_fields=["is_active", "updated_at"])
        return Response({
            "detail": f"Đã khôi phục kết nối cho Trang {instance.page_name}.",
            "data": FacebookPageConfigSerializer(instance).data
        })




# ── ViewSet: FacebookLead ─────────────────────────────────────────────────────

class FacebookLeadViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Danh sách hội thoại Facebook và chi tiết.
    Yêu cầu quyền: facebook.view_inbox
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = FacebookLead.objects.filter(company=self.request.user.company).select_related(
            "page_config", "customer", "assigned_to"
        )
        show_inactive = self.request.query_params.get("show_inactive")
        if show_inactive != "true":
            qs = qs.filter(page_config__is_active=True)

        page_config_id = self.request.query_params.get("page_config")
        if page_config_id and page_config_id != "all":
            qs = qs.filter(page_config_id=page_config_id)

        is_archived_param = self.request.query_params.get("is_archived")
        if is_archived_param == "true":
            qs = qs.filter(is_archived=True)
        else:
            qs = qs.filter(is_archived=False)

        is_starred_param = self.request.query_params.get("is_starred")
        if is_starred_param == "true":
            qs = qs.filter(is_starred=True)

        tag_id = self.request.query_params.get("tag_id")
        if tag_id and tag_id != "all":
            qs = qs.filter(tags__id=tag_id)

        assigned_to = self.request.query_params.get("assigned_to")
        if assigned_to:
            if assigned_to == "me":
                qs = qs.filter(assigned_to=self.request.user)
            elif assigned_to == "unassigned":
                qs = qs.filter(assigned_to__isnull=True)
            elif assigned_to != "all":
                qs = qs.filter(assigned_to_id=assigned_to)

        has_phone = self.request.query_params.get("has_phone")
        if has_phone == "true":
            qs = qs.exclude(detected_phone__isnull=True).exclude(detected_phone="")
        elif has_phone == "false":
            qs = qs.filter(detected_phone__isnull=True) | qs.filter(detected_phone="")

        has_unread = self.request.query_params.get("has_unread")
        if has_unread == "true":
            qs = qs.filter(has_unread_message=True)

        conv_status = self.request.query_params.get("status")
        if conv_status == "not_added":
            qs = qs.filter(is_customer_converted=False)
        elif conv_status == "converted":
            qs = qs.filter(is_customer_converted=True)

        from django.db.models import Subquery, OuterRef
        latest_sender_sq = Subquery(
            FacebookMessage.objects.filter(lead=OuterRef("pk"))
            .order_by("-created_at")
            .values("sender_type")[:1]
        )
        qs = qs.annotate(latest_sender=latest_sender_sq)

        reply_filter = self.request.query_params.get("reply_filter")
        if reply_filter == "unanswered":
            qs = qs.filter(latest_sender="customer")
        elif reply_filter == "read_unanswered":
            qs = qs.filter(latest_sender="customer", has_unread_message=False)

        sort_by = self.request.query_params.get("sort_by")
        if sort_by == "waiting_longest":
            if not reply_filter:
                qs = qs.filter(latest_sender="customer")
            return qs.order_by("last_message_at").distinct()
        elif sort_by == "time_asc":
            return qs.order_by("last_message_at").distinct()
        else:
            return qs.order_by("-last_message_at").distinct()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return FacebookLeadSerializer
        return FacebookLeadListSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.has_unread_message:
            instance.has_unread_message = False
            instance.save(update_fields=["has_unread_message"])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="send-message")
    def send_message(self, request, pk=None):
        """Gửi tin nhắn từ Trang Facebook tới khách hàng."""
        lead = self.get_object()
        text = request.data.get("text", "").strip()
        attachment_url = request.data.get("attachment_url")
        file_obj = request.FILES.get("file")
        request_phone = request.data.get("request_phone") in ["true", "True", True, 1, "1"]

        if request_phone and not text:
            text = "Dạ chào bạn, để tiện hỗ trợ và tư vấn chi tiết hơn, bạn cho mình xin số điện thoại liên hệ với ạ ❤️"

        if not text and not attachment_url and not file_obj:
            return Response({"error": "Vui lòng nhập nội dung hoặc chọn file/ảnh đính kèm."}, status=status.HTTP_400_BAD_REQUEST)

        config = lead.page_config
        saved_file_url = ""
        attachment_type = request.data.get("attachment_type") or "image"

        if file_obj:
            if file_obj.content_type and file_obj.content_type.startswith("image/"):
                attachment_type = "image"
            else:
                attachment_type = "file"

            try:
                ext = file_obj.name.split(".")[-1] if "." in file_obj.name else "bin"
                saved_path = default_storage.save(f"facebook_attachments/{uuid.uuid4().hex}.{ext}", file_obj)
                saved_file_url = request.build_absolute_uri(default_storage.url(saved_path))
            except Exception as e:
                logger.error(f"[Facebook] Lỗi lưu file local: {e}")

        result = send_facebook_message(
            page_access_token=config.page_access_token,
            recipient_psid=lead.fb_user_id,
            message_text=text,
            attachment_url=attachment_url,
            file_obj=file_obj,
            attachment_type=attachment_type
        )

        if result.get("success"):
            msg = FacebookMessage.objects.create(
                lead=lead,
                fb_message_id=result.get("message_id"),
                sender_type="page",
                text=text,
                attachment_url=saved_file_url or attachment_url or "",
                attachment_type=attachment_type if (saved_file_url or file_obj or attachment_url) else "",
            )
            lead.last_message_at = msg.created_at
            lead.last_message_preview = (text or "[Đính kèm]")[:255]
            lead.save(update_fields=["last_message_at", "last_message_preview"])
            return Response(FacebookMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
        else:
            return Response({"error": result.get("error")}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="rescan-phone")
    def rescan_phone(self, request, pk=None):
        """Quét lại tất cả tin nhắn cũ để tìm SĐT."""
        lead = self.get_object()
        
        # Nếu đã có SĐT thì có thể bỏ qua hoặc quét lại tuỳ logic, nhưng quét lại sẽ ghi đè
        messages = lead.messages.filter(sender_type="customer").order_by("-created_at")
        for msg in messages:
            phone = smart_extract_vn_phone(msg.text)
            if phone:
                lead.detected_phone = phone
                lead.save(update_fields=["detected_phone"])
                return Response({
                    "detail": f"Đã quét và tìm thấy SĐT: {phone}",
                    "phone": phone
                })
        
        return Response(
            {"error": "Không tìm thấy số điện thoại nào trong lịch sử tin nhắn của khách hàng này."},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=True, methods=["post"], url_path="toggle-star")
    def toggle_star(self, request, pk=None):
        """Bật/tắt đánh dấu sao (VIP) cho hội thoại."""
        lead = self.get_object()
        lead.is_starred = not lead.is_starred
        lead.save(update_fields=["is_starred"])
        return Response({
            "detail": "Đã cập nhật đánh dấu sao.",
            "is_starred": lead.is_starred,
        })

    @action(detail=True, methods=["post"], url_path="update-tags")
    def update_tags(self, request, pk=None):
        """Cập nhật danh sách nhãn/tag cho hội thoại."""
        lead = self.get_object()
        tag_ids = request.data.get("tag_ids", [])
        valid_tags = FacebookLeadTag.objects.filter(company=request.user.company, id__in=tag_ids)
        lead.tags.set(valid_tags)
        return Response({
            "detail": "Đã cập nhật nhãn hội thoại.",
            "tags": FacebookLeadTagSerializer(valid_tags, many=True).data,
        })

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """Chỉ định nhân viên (Sale) phụ trách hội thoại."""
        lead = self.get_object()
        assigned_to_id = request.data.get("assigned_to")
        if not assigned_to_id or assigned_to_id in ["unassigned", "none", "None"]:
            lead.assigned_to = None
        else:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.filter(company=request.user.company, id=assigned_to_id).first()
            if not user:
                return Response({"error": "Nhân viên không tồn tại hoặc không thuộc công ty."}, status=status.HTTP_400_BAD_REQUEST)
            lead.assigned_to = user
        lead.save(update_fields=["assigned_to"])
        return Response({
            "detail": "Đã phân công hội thoại.",
            "assigned_to": lead.assigned_to_id,
            "assigned_to_name": lead.assigned_to.full_name if lead.assigned_to else None,
        })

    @action(detail=True, methods=["post"], url_path="add-note")
    def add_note(self, request, pk=None):
        """Thêm ghi chú nội bộ cho hội thoại (chỉ nhân viên thấy)."""
        lead = self.get_object()
        content = request.data.get("content", "").strip()
        if not content:
            return Response({"error": "Vui lòng nhập nội dung ghi chú."}, status=status.HTTP_400_BAD_REQUEST)
        note = FacebookLeadNote.objects.create(
            lead=lead,
            user=request.user,
            content=content,
        )
        return Response(FacebookLeadNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="create-customer")
    def create_customer(self, request, pk=None):
        """Tạo khách hàng thủ công từ hội thoại Facebook."""
        lead = self.get_object()
        phone = request.data.get("phone", lead.detected_phone or "")
        name = request.data.get("name", lead.fb_user_name or "")

        if not phone:
            return Response({"error": "Vui lòng nhập số điện thoại."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer = convert_facebook_lead(lead, phone, customer_name=name)
            return Response({
                "detail": f"Đã tạo khách hàng '{customer.name}' thành công!",
                "customer_id": customer.id,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """Phân công nhân viên cho FacebookLead."""
        lead = self.get_object()
        assigned_to_id = request.data.get("assigned_to")

        if not assigned_to_id:
            lead.assigned_to = None
            lead.save(update_fields=["assigned_to"])
            return Response({"detail": "Đã xóa phân công."})

        from users.models import User
        try:
            user = User.objects.get(id=assigned_to_id, company=request.user.company)
        except User.DoesNotExist:
            return Response(
                {"detail": "Nhân viên không hợp lệ."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lead.assigned_to = user
        lead.save(update_fields=["assigned_to"])
        return Response({"detail": f"Đã phân công cho {user.get_full_name() or user.username}."})

    @action(detail=True, methods=["post"], url_path="scan-phone")
    def scan_phone(self, request, pk=None):
        """Thủ công kích hoạt quét SĐT lại cho hội thoại này."""
        lead = self.get_object()
        messages_qs = lead.messages.filter(sender_type="customer").order_by("-created_at")
        found_phone = None
        for msg in messages_qs:
            found_phone = extract_and_process_phone_fb(lead, msg.text)
            if found_phone:
                break

        if found_phone:
            return Response({"detail": f"Đã phát hiện SĐT: {found_phone}", "phone": found_phone})
        return Response({"detail": "Không tìm thấy số điện thoại trong hội thoại này."})

    @action(detail=False, methods=["post"], url_path="scan-all-phones")
    def scan_all_phones(self, request):
        """Quét SĐT cho tất cả hội thoại có tin nhắn văn bản."""
        page_config_id = request.data.get("page_config_id")
        qs = FacebookLead.objects.filter(company=request.user.company, detected_phone__isnull=True)
        if page_config_id:
            qs = qs.filter(page_config_id=page_config_id)

        found = 0
        for lead in qs:
            for msg in lead.messages.filter(sender_type="customer"):
                if msg.text:
                    phone = extract_and_process_phone_fb(lead, msg.text)
                    if phone:
                        found += 1
                        break

        return Response({"detail": f"Đã quét xong. Phát hiện {found} SĐT mới."})


# ── Webhook: Meta Facebook Messenger ─────────────────────────────────────────

class FacebookWebhookView(APIView):
    """
    Webhook endpoint cho Meta Facebook Messenger.
    GET: Xác nhận Webhook Challenge từ Meta Developers.
    POST: Nhận tin nhắn thời gian thực từ khách hàng.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        """Webhook Verification (Facebook Challenge)."""
        mode = request.query_params.get("hub.mode")
        challenge = request.query_params.get("hub.challenge")
        token = request.query_params.get("hub.verify_token")

        if mode == "subscribe" and challenge:
            from users.models import SystemSettings
            sys_settings = SystemSettings.objects.first()
            
            # Kiểm tra verify token với config của system HOẶC các pages đang active
            valid = False
            if sys_settings and sys_settings.facebook_webhook_secret == token:
                valid = True
            
            if not valid:
                valid = FacebookPageConfig.objects.filter(
                    webhook_verify_token=token, is_active=True
                ).exists()

            if valid:
                logger.info(f"[Facebook Webhook] Verification successful.")
                return HttpResponse(challenge, content_type="text/plain")

        logger.warning(f"[Facebook Webhook] Verification failed. Token: {token}")
        return HttpResponse("Forbidden", status=403)

    def post(self, request):
        """Nhận tin nhắn từ Facebook Messenger Webhook."""
        data = request.data
        if data.get("object") != "page":
            return Response({"status": "ignored"})

        entries = data.get("entry", [])
        for entry in entries:
            try:
                process_fb_webhook_message(entry)
            except Exception as e:
                logger.error(f"[Facebook Webhook] Error processing entry: {e}")

        return Response({"status": "EVENT_RECEIVED"})


# ── ViewSet: QuickMediaAsset ──────────────────────────────────────────────────

class QuickMediaAssetViewSet(viewsets.ModelViewSet):
    """
    Quản lý Thư viện file gửi nhanh (ảnh, video, báo giá...).
    """
    serializer_class = QuickMediaAssetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return QuickMediaAsset.objects.filter(company=self.request.user.company).order_by("-created_at")

    def perform_create(self, serializer):
        file_obj = self.request.FILES.get("file")
        file_url = self.request.data.get("file_url", "").strip()
        media_type = self.request.data.get("media_type", "image")

        if file_obj and not file_url:
            filename = f"quick_media/{uuid.uuid4().hex[:12]}_{file_obj.name}"
            saved_path = default_storage.save(filename, file_obj)
            file_url = f"/media/{saved_path}"

        serializer.save(
            company=self.request.user.company,
            created_by=self.request.user,
            file_url=file_url,
            media_type=media_type,
        )


# ── ViewSet: FacebookLeadTag ──────────────────────────────────────────────────

class FacebookLeadTagViewSet(viewsets.ModelViewSet):
    """Quản lý các thẻ/nhãn hội thoại Facebook của công ty."""
    serializer_class = FacebookLeadTagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FacebookLeadTag.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


# ── ViewSet: FacebookLeadNote ─────────────────────────────────────────────────

class FacebookLeadNoteViewSet(viewsets.ModelViewSet):
    """Quản lý ghi chú nội bộ cho hội thoại."""
    serializer_class = FacebookLeadNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        lead_id = self.request.query_params.get("lead")
        qs = FacebookLeadNote.objects.filter(lead__company=self.request.user.company)
        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ── ViewSet: FacebookQuickReply ───────────────────────────────────────────────

class FacebookQuickReplyViewSet(viewsets.ModelViewSet):
    """Quản lý tin nhắn mẫu (văn bản gõ tắt) của công ty."""
    serializer_class = FacebookQuickReplySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FacebookQuickReply.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company, created_by=self.request.user)


