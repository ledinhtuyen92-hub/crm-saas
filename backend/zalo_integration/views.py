"""
zalo_integration/views.py
API Views: Webhook handler + CRUD ViewSets cho module Zalo.
"""

import json
import logging

from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SocialLead, ZaloMessageLog, ZaloMessageTemplate, ZaloOaConfig
from .serializers import (
    ConvertLeadSerializer,
    SocialLeadDetailSerializer,
    SocialLeadListSerializer,
    SocialLeadUpdateSerializer,
    ZaloMessageLogSerializer,
    ZaloMessageTemplateSerializer,
    ZaloOaConfigSerializer,
    ZaloOaConfigWriteSerializer,
    ZaloMessageSerializer,
)
from .services import (
    convert_social_lead,
    fetch_zalo_user_profile,
    refresh_zalo_access_token,
    send_zns_message,
    verify_zalo_webhook_signature,
    send_zalo_chat_message,
    upload_file_to_zalo,
)

logger = logging.getLogger(__name__)


# ── Webhook Handler ───────────────────────────────────────────────────────────

class ZaloWebhookView(APIView):
    """
    Nhận và xử lý Webhook events từ Zalo OA.
    Endpoint này PUBLIC (không cần JWT) vì Zalo server gọi vào.
    Xác thực bằng chữ ký HMAC-SHA256.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        """Zalo Webhook Verification Challenge."""
        challenge = request.GET.get("challenge", "")
        return Response({"challenge": challenge})

    def post(self, request):
        """Nhận Webhook event."""
        body = request.body
        received_sig = request.META.get("HTTP_X_ZEVENT_SIGNATURE", "")

        # Parse data
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            return Response({"error": "Invalid JSON"}, status=status.HTTP_400_BAD_REQUEST)

        # Tìm OA Config theo oa_id (vì 1 app_id có thể dùng cho nhiều OA)
        oa_id = data.get("oa_id") or data.get("recipient", {}).get("id")
        app_id = data.get("app_id")
        
        try:
            oa_config = ZaloOaConfig.objects.select_related("company").get(
                oa_id=oa_id, is_active=True
            )
        except ZaloOaConfig.DoesNotExist:
            logger.warning(f"[Webhook] Không tìm thấy OA config cho oa_id={oa_id}")
            return Response({"error": "Unknown oa_id"}, status=status.HTTP_404_NOT_FOUND)

        # Xác thực chữ ký
        webhook_secret = oa_config.get_webhook_secret()
        if webhook_secret:
            timestamp_str = str(data.get("timestamp", ""))
            app_id_str = str(app_id)
            if not verify_zalo_webhook_signature(body, received_sig, app_id_str, timestamp_str, webhook_secret):
                logger.warning(f"[Webhook] Chữ ký không hợp lệ từ oa_id={oa_id}")
                return Response({"error": "Invalid signature"}, status=status.HTTP_403_FORBIDDEN)

        # Xử lý event
        event_name = data.get("event_name", "")
        company = oa_config.company

        if event_name == "user_send_text":
            self._handle_message(company, oa_config, data)
        elif event_name == "follow":
            self._handle_follow(company, oa_config, data)
        elif event_name == "unfollow":
            self._handle_unfollow(company, oa_config, data)
        else:
            logger.debug(f"[Webhook] Unhandled event: {event_name}")

        return Response({"status": "ok"})

    def _handle_message(self, company, oa_config, data):
        """Xử lý khi user nhắn tin vào OA."""
        sender = data.get("sender", {})
        zalo_uid = sender.get("id")
        if not zalo_uid:
            return

        message_text = data.get("message", {}).get("text", "")

        # Tạo hoặc lấy SocialLead hiện có
        social_lead, created = SocialLead.objects.get_or_create(
            company=company,
            platform=SocialLead.PLATFORM_ZALO,
            social_id=zalo_uid,
            defaults={
                "oa_config": oa_config,
                "display_name": sender.get("display_name", ""),
                "status": SocialLead.STATUS_CHATTING,
            },
        )

        if created:
            logger.info(f"[Webhook] Tạo SocialLead mới: uid={zalo_uid} ({company.name})")
            # Lấy thêm profile từ Zalo API (avatar, tên đầy đủ)
            if oa_config.access_token:
                profile = fetch_zalo_user_profile(oa_config, zalo_uid)
                if profile:
                    social_lead.display_name = profile.get("display_name") or social_lead.display_name
                    social_lead.avatar_url = profile.get("avatar_url")

        # Cập nhật thông tin tương tác mới nhất
        from django.utils import timezone
        social_lead.last_message = message_text[:500]
        social_lead.last_interaction_date = timezone.now()
        if social_lead.status == SocialLead.STATUS_NEW:
            social_lead.status = SocialLead.STATUS_CHATTING
        social_lead.has_unread_message = True
        social_lead.save()

        # Lưu vào ZaloMessage
        from .models import ZaloMessage
        
        message_id = data.get("message", {}).get("msg_id", "")
        # Zalo webhook gửi text ở 'text', và attachments ở 'attachments'
        attachments = data.get("message", {}).get("attachments", [])
        attachment_url = ""
        attachment_type = ""
        
        if attachments and len(attachments) > 0:
            att = attachments[0]
            attachment_type = att.get("type", "")
            if attachment_type == "image":
                attachment_url = att.get("payload", {}).get("url", "")
            elif attachment_type == "file":
                attachment_url = att.get("payload", {}).get("url", "")
            elif attachment_type == "audio":
                attachment_url = att.get("payload", {}).get("url", "")

        ZaloMessage.objects.create(
            company=company,
            social_lead=social_lead,
            direction=ZaloMessage.DIRECTION_INBOUND,
            content=message_text,
            attachment_url=attachment_url,
            attachment_type=attachment_type,
            zalo_msg_id=message_id,
        )

        # Push realtime notification cho nhân viên phụ trách
        if social_lead.assigned_to:
            self._push_notification(social_lead, message_text)

    def _handle_follow(self, company, oa_config, data):
        """Xử lý khi user follow OA."""
        follower = data.get("follower", {})
        zalo_uid = follower.get("id")
        if not zalo_uid:
            return

        SocialLead.objects.get_or_create(
            company=company,
            platform=SocialLead.PLATFORM_ZALO,
            social_id=zalo_uid,
            defaults={
                "oa_config": oa_config,
                "display_name": follower.get("display_name", ""),
                "status": SocialLead.STATUS_NEW,
            },
        )

    def _handle_unfollow(self, company, oa_config, data):
        """Xử lý khi user unfollow OA — archive lead nếu chưa convert."""
        follower = data.get("follower", {})
        zalo_uid = follower.get("id")
        if not zalo_uid:
            return

        SocialLead.objects.filter(
            company=company,
            platform=SocialLead.PLATFORM_ZALO,
            social_id=zalo_uid,
            status__in=[SocialLead.STATUS_NEW, SocialLead.STATUS_CHATTING],
        ).update(status=SocialLead.STATUS_ARCHIVED)

    def _push_notification(self, social_lead, message_text):
        """Gửi realtime notification qua WebSocket."""
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync

            channel_layer = get_channel_layer()
            group_name = f"user_{social_lead.assigned_to.id}"
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "send_notification",
                    "data": {
                        "type": "zalo_new_message",
                        "title": f"💬 Tin nhắn Zalo từ {social_lead.display_name or 'Khách'}",
                        "message": message_text[:100],
                        "link": f"/zalo/inbox/{social_lead.id}",
                    },
                },
            )
        except Exception as e:
            logger.warning(f"[Webhook] Không thể push notification: {e}")


# ── ZaloOaConfig ViewSet ─────────────────────────────────────────────────────

class ZaloOaConfigViewSet(viewsets.ModelViewSet):
    """CRUD cho cấu hình Zalo OA. Filter nghiêm ngặt theo company."""

    def get_queryset(self):
        return ZaloOaConfig.objects.filter(company=self.request.user.company)

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return ZaloOaConfigWriteSerializer
        return ZaloOaConfigSerializer

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)

    @action(detail=True, methods=["post"], url_path="refresh-token")
    def refresh_token(self, request, pk=None):
        """Manually refresh access token."""
        config = self.get_object()
        success = refresh_zalo_access_token(config)
        if success:
            config.refresh_from_db()
            serializer = ZaloOaConfigSerializer(config)
            return Response({
                "detail": "Token đã được làm mới thành công.",
                "data": serializer.data,
            })
        return Response(
            {"detail": "Không thể làm mới token. Vui lòng kiểm tra lại refresh_token."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=False, methods=["post"], url_path="exchange-oauth-code")
    def exchange_oauth_code(self, request):
        """
        Đổi Authorization Code từ Zalo lấy Access Token & Refresh Token.
        """
        code = request.data.get("code")
        if not code:
            return Response({"error": "Thiếu mã xác thực (code)"}, status=status.HTTP_400_BAD_REQUEST)

        config = ZaloOaConfig.objects.filter(company=request.user.company).first()
        
        # API của Zalo yêu cầu truyền code, app_id, secret_key
        app_id = config.get_app_id()
        secret_key = config.get_secret_key()
        
        if not config or not app_id or not secret_key:
            return Response({"error": "Cấu hình App ID/Secret chưa đầy đủ."}, status=status.HTTP_400_BAD_REQUEST)

        url = "https://oauth.zaloapp.com/v4/oa/access_token"
        headers = {"Content-Type": "application/x-www-form-urlencoded", "secret_key": secret_key}
        data = {
            "app_id": app_id,
            "grant_type": "authorization_code",
            "code": code
        }

        try:
            import requests
            from django.utils import timezone
            from datetime import timedelta

            resp = requests.post(url, headers=headers, data=data, timeout=10)
            res_json = resp.json()

            if "access_token" in res_json:
                config.access_token = res_json.get("access_token")
                config.refresh_token = res_json.get("refresh_token")
                expires_in = int(res_json.get("expires_in", 90000))
                config.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
                config.save()

                serializer = ZaloOaConfigSerializer(config)
                return Response({
                    "detail": "Cấp quyền và lấy Token thành công!",
                    "data": serializer.data,
                })
            else:
                err_msg = res_json.get("error_name") or res_json.get("error_description") or str(res_json)
                logger.error(f"[ZaloOAuth] Lỗi đổi token: {res_json}")
                return Response(
                    {"error": f"Zalo từ chối đổi Token: {err_msg}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception as exc:
            logger.error(f"[ZaloOAuth] Lỗi kết nối Zalo OAuth: {exc}")
            return Response(
                {"error": f"Lỗi kết nối tới Zalo server: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )



# ── SocialLead ViewSet ────────────────────────────────────────────────────────

class SocialLeadViewSet(viewsets.ModelViewSet):
    """
    Quản lý Social Leads — Tầng 1 của Phễu.
    Filter nghiêm ngặt theo company.
    """

    def get_queryset(self):
        qs = SocialLead.objects.filter(
            company=self.request.user.company
        ).select_related("assigned_to", "oa_config")

        # Filter theo status
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Filter theo platform
        platform = self.request.query_params.get("platform")
        if platform:
            qs = qs.filter(platform=platform)

        # Tìm kiếm
        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(display_name__icontains=search) |
                Q(social_id__icontains=search) |
                Q(last_message__icontains=search)
            )

        return qs.order_by("-last_interaction_date")

    def get_serializer_class(self):
        if self.action in ["update", "partial_update"]:
            return SocialLeadUpdateSerializer
        if self.action == "retrieve":
            return SocialLeadDetailSerializer
        return SocialLeadListSerializer

    def create(self, request, *args, **kwargs):
        return Response(
            {"detail": "SocialLead được tạo tự động qua Webhook. Không thể tạo thủ công."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=True, methods=["post"], url_path="convert")
    def convert(self, request, pk=None):
        """Chuyển đổi SocialLead -> Customer khi Sale có được SĐT."""
        social_lead = self.get_object()
        serializer = ConvertLeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone_number = serializer.validated_data["phone_number"]
        assigned_to_id = serializer.validated_data.get("assigned_to")

        assigned_user = None
        if assigned_to_id:
            from users.models import User
            try:
                assigned_user = User.objects.get(
                    id=assigned_to_id, company=request.user.company
                )
            except User.DoesNotExist:
                pass

        try:
            customer = convert_social_lead(social_lead, phone_number, assigned_user)
            return Response({
                "detail": "Chuyển đổi thành công! Hồ sơ khách hàng đã được tạo.",
                "customer_id": customer.id,
                "customer_name": customer.name,
                "customer_phone": customer.phone,
            })
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """Phân công nhân viên cho SocialLead."""
        social_lead = self.get_object()
        assigned_to_id = request.data.get("assigned_to")

        if not assigned_to_id:
            social_lead.assigned_to = None
            social_lead.save(update_fields=["assigned_to"])
            return Response({"detail": "Đã xóa phân công."})

        from users.models import User
        try:
            user = User.objects.get(id=assigned_to_id, company=request.user.company)
        except User.DoesNotExist:
            return Response(
                {"detail": "Nhân viên không hợp lệ."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        social_lead.assigned_to = user
        social_lead.save(update_fields=["assigned_to"])
        return Response({"detail": f"Đã phân công cho {user.get_full_name()}."})

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        """Lấy danh sách tin nhắn của 1 Lead và đánh dấu đã đọc."""
        lead = self.get_object()
        
        if lead.has_unread_message:
            lead.has_unread_message = False
            lead.save(update_fields=["has_unread_message"])
            
        from .models import ZaloMessage
        qs = ZaloMessage.objects.filter(social_lead=lead).order_by("created_at")
        serializer = ZaloMessageSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="send-message")
    def send_message(self, request, pk=None):
        """Sale gửi tin nhắn Text hoặc đính kèm File qua Zalo OA."""
        social_lead = self.get_object()
        oa_config = social_lead.oa_config

        if not oa_config:
            return Response({"error": "Không tìm thấy OA config"}, status=status.HTTP_400_BAD_REQUEST)

        if not oa_config.is_active:
            return Response({"error": "OA này đang tạm dừng"}, status=status.HTTP_400_BAD_REQUEST)

        text = request.data.get("text", "")
        request_phone = request.data.get("request_phone") in ["true", "True", True, 1, "1"]
        file_obj = request.FILES.get("file")

        if not text and not file_obj and not request_phone:
            return Response({"error": "Vui lòng nhập nội dung, đính kèm file hoặc yêu cầu SĐT."}, status=status.HTTP_400_BAD_REQUEST)

        file_token = ""
        image_id = ""
        attachment_url = ""
        attachment_type = ""
        force_as_file = request.data.get("force_as_file") in ["true", "True", True, 1, "1"]

        # Nếu có file, upload lên Zalo trước
        if file_obj:
            if file_obj.content_type.startswith("image/") and not force_as_file:
                from .services import upload_image_to_zalo
                image_id = upload_image_to_zalo(oa_config, file_obj)
                if image_id:
                    attachment_type = "image"
                else:
                    return Response({"error": "Upload ảnh lên Zalo thất bại (OA chưa nâng cấp)."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                from .services import upload_file_to_zalo
                file_token = upload_file_to_zalo(oa_config, file_obj)
                if not file_token:
                    return Response({"error": "Upload file lên Zalo thất bại."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                attachment_type = "file"
            
        # Gửi qua API Zalo
        res = send_zalo_chat_message(
            oa_config, social_lead.social_id, 
            text=text, 
            file_token=file_token, 
            image_id=image_id, 
            request_phone=request_phone
        )
        
        if res.get("error", 0) != 0:
            return Response(
                {"error": f"Lỗi từ Zalo: {res.get('message', '')}", "details": res},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Ghi vào DB
        from .models import ZaloMessage
        from django.utils import timezone
        
        msg_id = res.get("data", {}).get("message_id", "")
        
        msg = ZaloMessage.objects.create(
            company=request.user.company,
            social_lead=social_lead,
            direction=ZaloMessage.DIRECTION_OUTBOUND,
            content=text,
            attachment_url=attachment_url,
            attachment_type=attachment_type,
            zalo_msg_id=msg_id,
            sender_user=request.user,
        )

        # Cập nhật Lead
        social_lead.last_message = text[:500] if text else "[File đính kèm]"
        social_lead.last_interaction_date = timezone.now()
        social_lead.save(update_fields=["last_message", "last_interaction_date", "updated_at"])

        return Response(ZaloMessageSerializer(msg).data)


# ── ZaloMessageTemplate ViewSet ───────────────────────────────────────────────

class ZaloMessageTemplateViewSet(viewsets.ModelViewSet):
    """Quản lý mẫu ZNS. Filter theo company."""
    serializer_class = ZaloMessageTemplateSerializer

    def get_queryset(self):
        qs = ZaloMessageTemplate.objects.filter(company=self.request.user.company)
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)

    @action(detail=False, methods=["post"], url_path="send")
    def send_zns(self, request):
        """Gửi ZNS đến khách hàng hoặc social lead."""
        serializer = SendZNSSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        company = request.user.company

        # Lấy template
        try:
            template = ZaloMessageTemplate.objects.get(
                id=data["template_id"], company=company, is_active=True
            )
        except ZaloMessageTemplate.DoesNotExist:
            return Response(
                {"detail": "Mẫu ZNS không hợp lệ hoặc không hoạt động."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Tạo log record trước
        log = ZaloMessageLog.objects.create(
            company=company,
            template=template,
            sent_by=request.user,
            recipient_phone=data["recipient_phone"],
            recipient_zalo_id=data.get("recipient_zalo_id", ""),
            params_sent=data.get("params", {}),
            social_lead_id=data.get("social_lead_id"),
            customer_id=data.get("customer_id"),
            status=ZaloMessageLog.STATUS_PENDING,
        )

        # Đưa vào queue background processing
        from .tasks import send_zns_task
        send_zns_task.delay(log.id)

        return Response(
            {"detail": "Đã tạo yêu cầu gửi ZNS thành công", "log_id": log.id},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="bulk-send")
    def bulk_send(self, request):
        """Gửi ZNS hàng loạt cho nhiều khách hàng."""
        from .serializers import BulkSendZNSSerializer
        from users.models import Customer
        from .tasks import send_zns_task

        serializer = BulkSendZNSSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        company = request.user.company
        template_id = data["template_id"]
        customer_ids = data["customer_ids"]
        base_params = data.get("params", {})

        # 1. Lấy template
        try:
            template = ZaloMessageTemplate.objects.get(
                id=template_id, company=company, is_active=True
            )
        except ZaloMessageTemplate.DoesNotExist:
            return Response(
                {"detail": "Mẫu ZNS không hợp lệ hoặc không hoạt động."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # 2. Lấy danh sách khách hàng hợp lệ
        customers = Customer.objects.filter(id__in=customer_ids, company=company).exclude(phone="")
        if not customers.exists():
            return Response(
                {"detail": "Không tìm thấy khách hàng nào có số điện thoại hợp lệ."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Tạo logs và đẩy vào Celery
        logs_created = 0
        schema = template.params_schema or {}
        needs_name = any(k.endswith("name") or k.endswith("ten") or k.startswith("ten_") for k in schema.keys())
        
        for customer in customers:
            # Tự động map tên khách hàng nếu mẫu yêu cầu
            params = base_params.copy()
            if needs_name:
                for k in schema.keys():
                    if k.endswith("name") or k.endswith("ten") or k.startswith("ten_"):
                        if k not in params:
                            params[k] = customer.name

            # Tạo ZaloMessageLog
            log = ZaloMessageLog.objects.create(
                company=company,
                template=template,
                recipient_phone=customer.phone,
                customer=customer,
                params_sent=params,
                status=ZaloMessageLog.STATUS_PENDING,
            )
            
            # Gửi task vào Celery
            send_zns_task.delay(log.id)
            logs_created += 1

        return Response(
            {
                "detail": f"Đã đưa {logs_created} yêu cầu ZNS vào hàng đợi thành công.",
                "total_queued": logs_created
            },
            status=status.HTTP_200_OK,
        )


# ── ZaloMessageLog ViewSet (Read Only) ───────────────────────────────────────

class ZaloMessageLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Lịch sử gửi ZNS — chỉ đọc."""
    serializer_class = ZaloMessageLogSerializer

    def get_queryset(self):
        qs = ZaloMessageLog.objects.filter(
            company=self.request.user.company
        ).select_related("template", "social_lead", "customer", "sent_by")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs.order_by("-sent_at")
