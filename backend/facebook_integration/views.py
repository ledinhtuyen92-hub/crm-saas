"""
facebook_integration/views.py
API Views cho module Facebook Multi-Page Inbox.
"""

import logging

from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import FacebookLead, FacebookMessage, FacebookPageConfig
from .serializers import (
    FacebookLeadListSerializer,
    FacebookLeadSerializer,
    FacebookMessageSerializer,
    FacebookPageConfigSerializer,
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

        return Response({
            "detail": f"Đã kết nối Trang Facebook: {config.page_name} (ID: {config.page_id}) thành công!",
            "data": FacebookPageConfigSerializer(config).data,
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
        page_config_id = self.request.query_params.get("page_config")
        if page_config_id and page_config_id != "all":
            qs = qs.filter(page_config_id=page_config_id)

        has_phone = self.request.query_params.get("has_phone")
        if has_phone == "true":
            qs = qs.exclude(detected_phone__isnull=True).exclude(detected_phone="")

        conv_status = self.request.query_params.get("status")
        if conv_status == "not_added":
            qs = qs.filter(is_customer_converted=False)
        elif conv_status == "converted":
            qs = qs.filter(is_customer_converted=True)

        return qs.order_by("-last_message_at")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return FacebookLeadSerializer
        return FacebookLeadListSerializer

    @action(detail=True, methods=["post"], url_path="send-message")
    def send_message(self, request, pk=None):
        """Gửi tin nhắn từ Trang Facebook tới khách hàng."""
        lead = self.get_object()
        text = request.data.get("text", "").strip()
        attachment_url = request.data.get("attachment_url")

        if not text and not attachment_url:
            return Response({"error": "Thiếu nội dung tin nhắn."}, status=status.HTTP_400_BAD_REQUEST)

        config = lead.page_config
        result = send_facebook_message(
            page_access_token=config.page_access_token,
            recipient_psid=lead.fb_user_id,
            message_text=text,
            attachment_url=attachment_url,
        )

        if result.get("success"):
            # Lưu tin nhắn vào DB
            msg = FacebookMessage.objects.create(
                lead=lead,
                fb_message_id=result.get("message_id"),
                sender_type="page",
                text=text,
                attachment_url=attachment_url or "",
            )
            lead.last_message_at = msg.created_at
            lead.last_message_preview = (text or "[Đính kèm]")[:255]
            lead.save(update_fields=["last_message_at", "last_message_preview"])
            return Response(FacebookMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
        else:
            return Response({"error": result.get("error")}, status=status.HTTP_400_BAD_REQUEST)

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
