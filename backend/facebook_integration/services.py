"""
facebook_integration/services.py
Business logic layer cho module Facebook Multi-Page Inbox.
Tái sử dụng thuật toán smart_extract_vn_phone từ zalo_integration.
"""

import logging
import re

import requests
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

FB_GRAPH_API_BASE = "https://graph.facebook.com/v20.0"


# ── Tái sử dụng thuật toán quét SĐT thông minh ───────────────────────────────

def normalize_phone(phone: str) -> str:
    phone = phone.strip().replace(" ", "").replace("-", "").replace(".", "")
    if phone.startswith("+84"):
        phone = "0" + phone[3:]
    elif phone.startswith("84") and len(phone) == 11:
        phone = "0" + phone[2:]
    return phone


def smart_extract_vn_phone(text: str):
    """
    Thuật toán phát hiện và chuẩn hoá SĐT Việt Nam thông minh.
    Tái sử dụng từ zalo_integration.services.
    """
    if not text:
        return None

    pattern_explicit = re.compile(
        r'(?:(?:\+|00)?84[\s\.\-]?|0)[\s\.\-]?([35789](?:[\s\.\-]?\d){8})\b'
    )
    for m in pattern_explicit.finditer(text):
        digits = re.sub(r'\D', '', m.group(1))
        if len(digits) == 9:
            tail_idx = m.end()
            tail_str = text[tail_idx:tail_idx+15].lower()
            if not any(curr in tail_str for curr in ['đ', 'vnd', 'k', 'tr', 'triệu', 'ty', 'tỷ']):
                return '0' + digits

    pattern_implicit = re.compile(r'\b([35789](?:[\s\.\-]?\d){8})\b')
    phone_keywords = ['sdt', 'sđt', 'so', 'số', 'phone', 'zalo', 'fb', 'facebook', 'lh', 'liên hệ', 'gọi', 'alo']
    text_lower = text.lower()
    has_keyword = any(kw in text_lower for kw in phone_keywords)

    for m in pattern_implicit.finditer(text):
        raw = m.group(1)
        digits = re.sub(r'\D', '', raw)
        if len(digits) == 9:
            has_separator = any(sep in raw for sep in [' ', '.', '-'])
            tail_idx = m.end()
            tail_str = text[tail_idx:tail_idx+15].lower()
            is_currency = any(curr in tail_str for curr in ['đ', 'vnd', 'k', 'tr', 'triệu', 'ty', 'tỷ', '000'])
            if not is_currency and (has_keyword or has_separator):
                return '0' + digits

    return None


# ── Gửi tin nhắn qua Facebook Graph API ──────────────────────────────────────

def send_facebook_message(page_access_token: str, recipient_psid: str, message_text: str, attachment_url: str = None) -> dict:
    """
    Gửi tin nhắn văn bản (hoặc ảnh đính kèm) từ Trang Facebook tới khách hàng.
    """
    if not page_access_token or not recipient_psid:
        return {"success": False, "error": "Thiếu token hoặc recipient_id."}

    url = f"{FB_GRAPH_API_BASE}/me/messages"
    params = {"access_token": page_access_token}

    if attachment_url:
        payload = {
            "recipient": {"id": recipient_psid},
            "message": {
                "attachment": {
                    "type": "image",
                    "payload": {"url": attachment_url, "is_reusable": True}
                }
            }
        }
    else:
        payload = {
            "recipient": {"id": recipient_psid},
            "message": {"text": message_text}
        }

    try:
        resp = requests.post(url, params=params, json=payload, timeout=10)
        data = resp.json()
        if "error" in data:
            logger.error(f"[Facebook] Lỗi gửi tin nhắn: {data['error']}")
            return {"success": False, "error": data["error"].get("message", "Lỗi không xác định")}
        return {"success": True, "message_id": data.get("message_id")}
    except requests.RequestException as e:
        logger.error(f"[Facebook] Lỗi kết nối Graph API: {e}")
        return {"success": False, "error": str(e)}


# ── Lấy thông tin Profile Facebook User ──────────────────────────────────────

def get_fb_user_profile(page_access_token: str, psid: str) -> dict:
    """
    Lấy tên và avatar của người dùng Facebook từ PSID.
    """
    url = f"{FB_GRAPH_API_BASE}/{psid}"
    params = {
        "fields": "name,profile_pic",
        "access_token": page_access_token
    }
    try:
        resp = requests.get(url, params=params, timeout=8)
        data = resp.json()
        if "error" not in data:
            return {
                "name": data.get("name", ""),
                "avatar": data.get("profile_pic", "")
            }
    except Exception as e:
        logger.error(f"[Facebook] Error getting user profile for {psid}: {e}")
    return {"name": "", "avatar": ""}


# ── Xử lý Webhook Message từ Meta ────────────────────────────────────────────

def process_fb_webhook_message(entry: dict):
    """
    Xử lý một entry từ Webhook payload của Facebook Messenger.
    Tạo/cập nhật FacebookLead và FacebookMessage, quét SĐT nếu có.
    """
    from facebook_integration.models import FacebookPageConfig, FacebookLead, FacebookMessage

    page_id = entry.get("id")
    messaging_list = entry.get("messaging", [])

    # Tìm cấu hình Trang Facebook tương ứng
    page_config = FacebookPageConfig.objects.filter(page_id=page_id, is_active=True).first()
    if not page_config:
        logger.warning(f"[Facebook] Không tìm thấy config cho page_id={page_id}")
        return

    for messaging in messaging_list:
        sender_psid = messaging.get("sender", {}).get("id")
        message_data = messaging.get("message", {})
        if not sender_psid or not message_data:
            continue

        # Bỏ qua tin nhắn do chính page gửi đi (echo)
        if str(sender_psid) == str(page_id):
            continue

        msg_id = message_data.get("mid")
        msg_text = message_data.get("text", "")

        # Lấy thông tin profile khách
        profile = get_fb_user_profile(page_config.page_access_token, sender_psid)

        # Tạo hoặc cập nhật FacebookLead
        lead, created = FacebookLead.objects.get_or_create(
            page_config=page_config,
            fb_user_id=sender_psid,
            defaults={
                "company": page_config.company,
                "fb_user_name": profile.get("name", ""),
                "fb_user_avatar": profile.get("avatar", ""),
                "assigned_to": page_config.assigned_to,
            }
        )
        if not created:
            if profile.get("name") and not lead.fb_user_name:
                lead.fb_user_name = profile["name"]
            if profile.get("avatar") and not lead.fb_user_avatar:
                lead.fb_user_avatar = profile["avatar"]

        # Cập nhật trạng thái is_customer_converted nếu cần
        if lead.customer:
            from crm.models import Customer
            if not Customer.objects.filter(id=lead.customer_id).exists():
                lead.is_customer_converted = False
                lead.customer = None

        lead.last_message_at = timezone.now()
        lead.last_message_preview = (msg_text or "[Đính kèm]")[:255]
        lead.save()

        # Lưu tin nhắn
        attachments = message_data.get("attachments", [])
        att_url = None
        att_type = ""
        if attachments:
            att = attachments[0]
            att_type = att.get("type", "")
            att_url = att.get("payload", {}).get("url", "")

        if msg_id:
            FacebookMessage.objects.get_or_create(
                fb_message_id=msg_id,
                defaults={
                    "lead": lead,
                    "sender_type": "customer",
                    "text": msg_text,
                    "attachment_url": att_url,
                    "attachment_type": att_type,
                }
            )

        # Quét SĐT trong tin nhắn
        if msg_text:
            extract_and_process_phone_fb(lead, msg_text)


# ── Trích xuất và xử lý SĐT từ hội thoại Facebook ───────────────────────────

def extract_and_process_phone_fb(lead, text: str):
    """
    Quét SĐT trong tin nhắn Facebook với thuật toán thông minh.
    Tự động tạo KH hoặc đánh dấu trạng thái tuỳ theo cấu hình.
    """
    if not text:
        return None

    norm_phone = smart_extract_vn_phone(text)
    if not norm_phone:
        return None

    if not lead.detected_phone:
        lead.detected_phone = norm_phone

    from crm.models import Customer
    company = lead.company
    already_exists = Customer.objects.filter(company=company, phone=norm_phone).exists()

    auto_create = lead.page_config.auto_create_customer_from_phone

    if already_exists:
        existing_customer = Customer.objects.filter(company=company, phone=norm_phone).first()
        lead.is_customer_converted = True
        lead.customer = existing_customer
        lead.save(update_fields=["detected_phone", "is_customer_converted", "customer", "updated_at"])
    elif auto_create:
        try:
            convert_facebook_lead(lead, norm_phone)
            logger.info(f"[FacebookAutoScan] Tự động tạo KH từ SĐT {norm_phone} của Lead #{lead.id}")
        except Exception as e:
            logger.error(f"[FacebookAutoScan] Lỗi tự động tạo KH từ SĐT {norm_phone}: {e}")
            lead.save(update_fields=["detected_phone", "updated_at"])
    else:
        lead.is_customer_converted = False
        lead.save(update_fields=["detected_phone", "is_customer_converted", "updated_at"])

    return norm_phone


# ── Chuyển đổi FacebookLead → Customer ───────────────────────────────────────

@transaction.atomic
def convert_facebook_lead(lead, phone_number: str, assigned_user=None, customer_name: str = None):
    """
    Tạo mới hoặc liên kết Customer từ FacebookLead.
    """
    from crm.models import Customer

    company = lead.company
    final_name = customer_name or lead.fb_user_name or f"KH Facebook {lead.fb_user_id[-6:]}"

    existing = Customer.objects.filter(company=company, phone=phone_number).first()
    if existing:
        customer = existing
    else:
        customer = Customer.objects.create(
            company=company,
            name=final_name,
            phone=phone_number,
            source="facebook",
            status="new",
            assigned_to=assigned_user or lead.assigned_to,
        )
        logger.info(f"[FacebookConvert] Created Customer #{customer.id} from Lead #{lead.id}")

    lead.customer = customer
    lead.is_customer_converted = True
    if phone_number and not lead.detected_phone:
        lead.detected_phone = phone_number
    lead.save(update_fields=["customer", "is_customer_converted", "detected_phone", "updated_at"])

    return customer
