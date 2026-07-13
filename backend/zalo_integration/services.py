"""
zalo_integration/services.py
Business logic layer cho module Zalo Integration.
Tách khỏi views để dễ test và tái sử dụng.
"""

import hashlib
import hmac
import logging

import requests
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

ZALO_TOKEN_URL = "https://oauth.zaloapp.com/v4/oa/access_token"
ZALO_SEND_ZNS_URL = "https://business.openapi.zalo.me/message/template"
ZALO_USER_PROFILE_URL = "https://openapi.zalo.me/v2.0/oa/getprofile"
ZALO_SEND_MSG_URL = "https://openapi.zalo.me/v2.0/oa/message"
ZALO_UPLOAD_FILE_URL = "https://openapi.zalo.me/v2.0/oa/upload/file"


# ── Xác thực Webhook ─────────────────────────────────────────────────────────

def verify_zalo_webhook_signature(request_body: bytes, received_signature: str, app_secret: str) -> bool:
    """
    Xác thực chữ ký HMAC-SHA256 từ Zalo.
    Zalo gửi chữ ký trong header: X-ZEvent-Signature: <mac>
    """
    if not received_signature or not app_secret:
        return False
    expected = hmac.new(
        app_secret.encode("utf-8"),
        request_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, received_signature)


# ── Chuẩn hóa số điện thoại ──────────────────────────────────────────────────

def normalize_phone(phone: str) -> str:
    """
    Chuẩn hóa SĐT về định dạng 10 số (0xxx).
    VD: +84901234567 -> 0901234567
        84901234567  -> 0901234567
        0901234567   -> 0901234567
    """
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("+84"):
        phone = "0" + phone[3:]
    elif phone.startswith("84") and len(phone) == 11:
        phone = "0" + phone[2:]
    return phone


# ── Convert SocialLead -> Customer ───────────────────────────────────────────

def convert_social_lead(social_lead, phone_number: str, assigned_user=None):
    """
    Chuyển đổi SocialLead (Tầng 1) thành Customer (Tầng 2 — hồ sơ chuẩn).

    Xử lý 2 trường hợp:
    1. Khách mới hoàn toàn: Tạo Customer mới.
    2. Số điện thoại đã tồn tại: Gắn social_lead vào Customer cũ (merge).

    Returns:
        Customer instance vừa tạo/merge.
    Raises:
        ValueError nếu lead đã được convert trước đó.
    """
    from crm.models import Customer

    if social_lead.status == "converted":
        raise ValueError(f"SocialLead #{social_lead.id} đã được chuyển đổi thành Customer trước đó.")

    phone_number = normalize_phone(phone_number)
    company = social_lead.company

    with transaction.atomic():
        # Kiểm tra xem SĐT đã tồn tại chưa
        existing_customer = Customer.objects.filter(
            company=company,
            phone=phone_number,
        ).first()

        if existing_customer:
            # MERGE: Gắn social_lead vào customer đã có
            if existing_customer.social_lead is None:
                existing_customer.social_lead = social_lead
                existing_customer.save(update_fields=["social_lead", "updated_at"])
            customer = existing_customer
            logger.info(
                f"[ZaloConvert] Merged SocialLead #{social_lead.id} "
                f"-> existing Customer #{customer.id} (phone: {phone_number})"
            )
        else:
            # CREATE: Tạo Customer mới từ data của SocialLead
            customer = Customer.objects.create(
                company=company,
                name=social_lead.display_name or f"Khách Zalo ({social_lead.social_id[-4:]})",
                phone=phone_number,
                source="zalo",
                status="new",
                social_lead=social_lead,
                assigned_to=assigned_user or social_lead.assigned_to,
            )
            logger.info(
                f"[ZaloConvert] Created new Customer #{customer.id} "
                f"from SocialLead #{social_lead.id} (phone: {phone_number})"
            )

        # Cập nhật trạng thái SocialLead
        social_lead.status = "converted"
        social_lead.save(update_fields=["status", "updated_at"])

    return customer


# ── Refresh Token Zalo ────────────────────────────────────────────────────────

def refresh_zalo_access_token(oa_config):
    """
    Gọi Zalo API để đổi refresh_token lấy access_token mới.
    Cập nhật ZaloOaConfig với token mới.

    Returns:
        True nếu thành công, False nếu thất bại.
    """
    if not oa_config.refresh_token:
        logger.warning(f"[ZaloToken] OA '{oa_config.oa_name}' không có refresh_token.")
        return False

    try:
        response = requests.post(
            ZALO_TOKEN_URL,
            data={
                "app_id": oa_config.app_id,
                "grant_type": "refresh_token",
                "refresh_token": oa_config.refresh_token,
            },
            headers={"secret_key": oa_config.secret_key},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        if "access_token" not in data:
            logger.error(f"[ZaloToken] Refresh failed for '{oa_config.oa_name}': {data}")
            return False

        from datetime import timedelta
        oa_config.access_token = data["access_token"]
        oa_config.refresh_token = data.get("refresh_token", oa_config.refresh_token)
        oa_config.token_expires_at = timezone.now() + timedelta(seconds=data.get("expires_in", 86400))
        oa_config.save(update_fields=["access_token", "refresh_token", "token_expires_at"])

        logger.info(f"[ZaloToken] ✅ Refreshed token for OA: '{oa_config.oa_name}'")
        return True

    except requests.RequestException as e:
        logger.error(f"[ZaloToken] ❌ Request error for '{oa_config.oa_name}': {e}")
        return False


# ── Gửi ZNS ──────────────────────────────────────────────────────────────────

def send_zns_message(log_id: int) -> bool:
    """
    Gửi ZNS dựa trên ZaloMessageLog record.
    Được gọi từ Celery task hoặc trực tiếp (cho retry).

    Returns:
        True nếu gửi thành công.
    """
    from zalo_integration.models import ZaloMessageLog, ZaloOaConfig

    try:
        log = ZaloMessageLog.objects.select_related("company", "template").get(id=log_id)
    except ZaloMessageLog.DoesNotExist:
        logger.error(f"[ZaloZNS] Log #{log_id} không tồn tại.")
        return False

    try:
        oa_config = ZaloOaConfig.objects.get(company=log.company, is_active=True)
    except ZaloOaConfig.DoesNotExist:
        log.status = ZaloMessageLog.STATUS_FAILED
        log.error_message = "Không tìm thấy cấu hình Zalo OA đang hoạt động."
        log.save(update_fields=["status", "error_message"])
        return False

    # Refresh token nếu sắp hết hạn
    if oa_config.is_token_near_expiry:
        refresh_zalo_access_token(oa_config)
        oa_config.refresh_from_db()

    try:
        response = requests.post(
            ZALO_SEND_ZNS_URL,
            headers={
                "access_token": oa_config.access_token,
                "Content-Type": "application/json",
            },
            json={
                "phone": log.recipient_phone,
                "template_id": log.template.zalo_template_id if log.template else "",
                "template_data": log.params_sent,
                "tracking_id": f"crm-log-{log.id}",
            },
            timeout=20,
        )
        result = response.json()

        if result.get("error") == 0:
            log.status = ZaloMessageLog.STATUS_SENT
            log.zalo_msg_id = result.get("data", {}).get("msg_id", "")
            logger.info(f"[ZaloZNS] ✅ Sent ZNS to {log.recipient_phone}, msg_id={log.zalo_msg_id}")
        else:
            log.status = ZaloMessageLog.STATUS_FAILED
            log.error_message = result.get("message", "Unknown Zalo API error")
            logger.error(f"[ZaloZNS] ❌ Failed to send ZNS: {result}")

    except requests.RequestException as e:
        log.status = ZaloMessageLog.STATUS_FAILED
        log.error_message = str(e)
        logger.error(f"[ZaloZNS] ❌ Request exception: {e}")

    log.save(update_fields=["status", "zalo_msg_id", "error_message"])
    return log.status == ZaloMessageLog.STATUS_SENT


# ── Live Chat (Inbox) ────────────────────────────────────────────────────────

def upload_file_to_zalo(oa_config, file_obj) -> str:
    """
    Upload file lên Zalo để lấy File Token.
    """
    if oa_config.is_token_near_expiry:
        refresh_zalo_access_token(oa_config)
        oa_config.refresh_from_db()

    try:
        response = requests.post(
            ZALO_UPLOAD_FILE_URL,
            headers={"access_token": oa_config.access_token},
            files={"file": (file_obj.name, file_obj, file_obj.content_type)},
            timeout=30,
        )
        response.raise_for_status()
        res_data = response.json()
        if res_data.get("error") == 0:
            return res_data.get("data", {}).get("token", "")
        logger.error(f"[ZaloUpload] Error: {res_data}")
        return ""
    except Exception as e:
        logger.error(f"[ZaloUpload] Exception: {e}")
        return ""


def send_zalo_chat_message(oa_config, zalo_uid: str, text: str = "", file_token: str = "") -> dict:
    """
    Gửi tin nhắn chat thông thường tới Zalo User (Text hoặc File).
    """
    if oa_config.is_token_near_expiry:
        refresh_zalo_access_token(oa_config)
        oa_config.refresh_from_db()

    payload = {"recipient": {"user_id": zalo_uid}, "message": {}}

    if file_token:
        payload["message"]["attachment"] = {
            "type": "file",
            "payload": {"token": file_token}
        }
    elif text:
        payload["message"]["text"] = text
    else:
        return {"error": -1, "message": "No content to send"}

    try:
        response = requests.post(
            ZALO_SEND_MSG_URL,
            headers={"access_token": oa_config.access_token, "Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"[ZaloChat] Send error: {e}")
        return {"error": -1, "message": str(e)}


# ── Lấy profile user Zalo ─────────────────────────────────────────────────────

def fetch_zalo_user_profile(oa_config, zalo_user_id: str) -> dict:
    """
    Gọi Zalo API để lấy tên và avatar của user.
    Returns dict với keys: display_name, avatar_url, hoặc {} nếu lỗi.
    """
    try:
        response = requests.get(
            ZALO_USER_PROFILE_URL,
            params={"user_id": zalo_user_id},
            headers={"access_token": oa_config.access_token},
            timeout=10,
        )
        data = response.json()
        if data.get("error") == 0:
            user_data = data.get("data", {})
            return {
                "display_name": user_data.get("display_name", ""),
                "avatar_url": user_data.get("avatar", ""),
            }
    except Exception as e:
        logger.warning(f"[ZaloProfile] Cannot fetch profile for {zalo_user_id}: {e}")
    return {}
