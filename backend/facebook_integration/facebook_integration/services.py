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


# ── Facebook OAuth Flow ───────────────────────────────────────────────────────

def exchange_short_lived_token(app_id: str, app_secret: str, short_token: str) -> dict:
    """
    Đổi Short-Lived User Access Token (1 giờ) → Long-Lived User Access Token (60 ngày).
    """
    url = f"{FB_GRAPH_API_BASE}/oauth/access_token"
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_token,
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        if "error" in data:
            logger.error(f"[Facebook OAuth] exchange short token error: {data['error']}")
            return {"success": False, "error": data["error"].get("message", "Token exchange failed.")}
        return {
            "success": True,
            "access_token": data.get("access_token"),
            "token_type": data.get("token_type"),
            "expires_in": data.get("expires_in"),  # seconds
        }
    except Exception as e:
        logger.error(f"[Facebook OAuth] exchange token exception: {e}")
        return {"success": False, "error": str(e)}


def get_managed_pages(long_lived_user_token: str) -> list:
    """
    Lấy danh sách các Trang Facebook mà user này quản lý (admin/editor).
    Trả về list các dict: {id, name, access_token, category, fan_count}
    Page Access Token lấy từ đây là LONG-LIVED và KHÔNG BAO GIỜ HẾT HẠN.
    """
    url = f"{FB_GRAPH_API_BASE}/me/accounts"
    params = {
        "access_token": long_lived_user_token,
        "fields": "id,name,access_token,category,fan_count,picture",
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        if "error" in data:
            logger.error(f"[Facebook OAuth] get_managed_pages error: {data['error']}")
            return []
        return data.get("data", [])
    except Exception as e:
        logger.error(f"[Facebook OAuth] get_managed_pages exception: {e}")
        return []


def debug_facebook_token(app_id: str, app_secret: str, input_token: str) -> dict:
    """
    Dùng Graph API /debug_token để kiểm tra thông tin token:
    - is_valid: Token có còn hợp lệ không
    - expires_at: Unix timestamp hết hạn (0 = không hết hạn)
    - type: PAGE, USER, APP...
    - scopes: danh sách quyền được cấp
    """
    url = f"{FB_GRAPH_API_BASE}/debug_token"
    access_token = f"{app_id}|{app_secret}"  # App Token
    params = {
        "input_token": input_token,
        "access_token": access_token,
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        if "error" in data:
            logger.error(f"[Facebook] debug_token error: {data['error']}")
            return {"success": False, "error": data["error"].get("message", "Lỗi kết nối Meta API.")}
        token_data = data.get("data", {})
        return {
            "success": True,
            "is_valid": token_data.get("is_valid", False),
            "expires_at": token_data.get("expires_at", 0),  # Unix timestamp; 0 = never
            "type": token_data.get("type", ""),
            "app_id": token_data.get("app_id", ""),
            "scopes": token_data.get("scopes", []),
        }
    except Exception as e:
        logger.error(f"[Facebook] debug_token exception: {e}")
        return {"success": False, "error": str(e)}



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


# ── Đồng bộ Lịch sử Trò chuyện từ Graph API ──────────────────────────────────

def sync_page_conversations_history(page_config, max_conversations: int = 100, limit_messages: int = 50):
    """
    Kéo danh sách hội thoại cũ (/conversations) và tin nhắn (/messages)
    cho một Trang Facebook từ Graph API.
    """
    if not page_config.page_access_token or not page_config.page_id:
        raise ValueError("Trang Facebook chưa có Page ID hoặc Page Access Token hợp lệ.")

    token = page_config.page_access_token
    page_id = str(page_config.page_id)
    url = f"{FB_GRAPH_API_BASE}/{page_id}/conversations"
    params = {
        "fields": "id,participants,updated_time,snippet,unread_count,message_count",
        "access_token": token,
        "limit": min(max_conversations, 100),
    }

    synced_conversations = 0
    synced_messages = 0

    from facebook_integration.models import FacebookLead, FacebookMessage
    from django.utils.dateparse import parse_datetime

    while url and synced_conversations < max_conversations:
        try:
            resp = requests.get(url, params=params, timeout=15)
            if resp.status_code != 200:
                logger.error(f"[SyncHistory] Lỗi gọi API /conversations: {resp.status_code} - {resp.text}")
                break
            data = resp.json()
        except Exception as e:
            logger.error(f"[SyncHistory] Lỗi kết nối Graph API: {e}")
            break

        conv_list = data.get("data", [])
        if not conv_list:
            break

        for conv in conv_list:
            if synced_conversations >= max_conversations:
                break

            conv_id = conv.get("id")
            participants = conv.get("participants", {}).get("data", [])
            psid = None
            psid_name = ""
            for p in participants:
                if str(p.get("id")) != page_id:
                    psid = str(p.get("id"))
                    psid_name = p.get("name", "")
                    break

            if not psid:
                continue

            upd_str = conv.get("updated_time")
            last_dt = parse_datetime(upd_str) if upd_str else timezone.now()
            snippet = conv.get("snippet", "")
            unread = (conv.get("unread_count", 0) > 0)

            lead, created = FacebookLead.objects.get_or_create(
                page_config=page_config,
                fb_user_id=psid,
                defaults={
                    "company": page_config.company,
                    "fb_user_name": psid_name or f"FB {psid[-6:]}",
                    "last_message_at": last_dt,
                    "last_message_preview": snippet[:255],
                    "has_unread_message": unread,
                    "assigned_to": page_config.assigned_to,
                }
            )
            if created or not lead.fb_user_avatar or not lead.fb_user_name or lead.fb_user_name.startswith("FB "):
                profile = get_fb_user_profile(token, psid)
                if profile.get("name"):
                    lead.fb_user_name = profile["name"]
                elif psid_name and not lead.fb_user_name:
                    lead.fb_user_name = psid_name
                if profile.get("avatar"):
                    lead.fb_user_avatar = profile["avatar"]
                if not lead.company_id and page_config.company_id:
                    lead.company = page_config.company
                if last_dt and (not lead.last_message_at or last_dt > lead.last_message_at):
                    lead.last_message_at = last_dt
                    lead.last_message_preview = snippet[:255]
                    lead.has_unread_message = unread
                lead.save()
            else:
                if not lead.company_id and page_config.company_id:
                    lead.company = page_config.company
                if psid_name and not lead.fb_user_name:
                    lead.fb_user_name = psid_name
                if last_dt and (not lead.last_message_at or last_dt > lead.last_message_at):
                    lead.last_message_at = last_dt
                    lead.last_message_preview = snippet[:255]
                    lead.has_unread_message = unread
                lead.save()

            synced_conversations += 1

            msg_url = f"{FB_GRAPH_API_BASE}/{conv_id}/messages"
            msg_params = {
                "fields": "id,created_time,from,to,message,attachments{id,mime_type,name,size,image_data,video_data,file_url,payload}",
                "access_token": token,
                "limit": min(limit_messages, 100),
            }
            try:
                m_resp = requests.get(msg_url, params=msg_params, timeout=10)
                if m_resp.status_code == 200:
                    m_data = m_resp.json().get("data", [])
                    m_data.reverse()
                    for m_item in m_data:
                        m_id = m_item.get("id")
                        if not m_id:
                            continue
                        m_from = m_item.get("from", {})
                        from_id = str(m_from.get("id", ""))
                        s_type = "customer" if (from_id and str(from_id) == str(psid)) else "page"
                        m_text = m_item.get("message", "")

                        att_url = None
                        att_type = ""
                        atts = m_item.get("attachments", {}).get("data", [])
                        if atts:
                            first_att = atts[0]
                            mime = (first_att.get("mime_type") or "").lower()
                            payload = first_att.get("payload", {})
                            img_data = first_att.get("image_data", {})
                            vid_data = first_att.get("video_data", {})

                            att_url = (
                                payload.get("url")
                                or img_data.get("url")
                                or img_data.get("preview_url")
                                or vid_data.get("url")
                                or vid_data.get("preview_url")
                                or first_att.get("file_url")
                                or first_att.get("url")
                            )

                            if mime.startswith("image/") or img_data or (att_url and any(ext in att_url.lower() for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", "scontent", "fbcdn"])):
                                att_type = "image"
                            elif mime.startswith("video/") or vid_data or (att_url and any(ext in att_url.lower() for ext in [".mp4", ".mov", ".avi", ".webm"])):
                                att_type = "video"
                            elif mime.startswith("audio/"):
                                att_type = "audio"
                            elif att_url:
                                att_type = "file"

                        c_dt_str = m_item.get("created_time")
                        c_dt = parse_datetime(c_dt_str) if c_dt_str else timezone.now()

                        msg_obj, m_created = FacebookMessage.objects.get_or_create(
                            fb_message_id=m_id,
                            defaults={
                                "lead": lead,
                                "sender_type": s_type,
                                "text": m_text,
                                "attachment_url": att_url,
                                "attachment_type": att_type,
                            }
                        )
                        if m_created:
                            FacebookMessage.objects.filter(id=msg_obj.id).update(created_at=c_dt)
                            synced_messages += 1

                            if s_type == "customer" and m_text:
                                smart_scan_and_auto_create_customer(lead, m_text)

            except Exception as me:
                logger.error(f"[SyncHistory] Lỗi kéo tin nhắn của hội thoại {conv_id}: {me}")

        paging = data.get("paging", {})
        url = paging.get("next")
        params = {}

    logger.info(f"[SyncHistory] Đã đồng bộ xong cho Trang {page_config.page_name}: {synced_conversations} hội thoại, {synced_messages} tin nhắn.")
    return {
        "synced_conversations": synced_conversations,
        "synced_messages": synced_messages,
    }

