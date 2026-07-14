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
    extract_and_process_phone_fb,
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
        """Kiểm tra Page Access Token có hợp lệ không thông qua Graph API."""
        config = self.get_object()
        if not config.page_access_token:
            return Response({"error": "Chưa có Page Access Token."}, status=status.HTTP_400_BAD_REQUEST)

        import requests as req
        url = f"https://graph.facebook.com/v20.0/me"
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
            # Kiểm tra verify token với tất cả pages đang active
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
