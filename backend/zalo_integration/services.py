"""
zalo_integration/services.py
Business logic layer cho module Zalo Integration.
Tách khỏi views để dễ test và tái sử dụng.
"""

import hashlib
import hmac
import logging
import re

import requests
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

ZALO_TOKEN_URL = "https://oauth.zaloapp.com/v4/oa/access_token"
ZALO_SEND_ZNS_URL = "https://business.openapi.zalo.me/message/template"
ZALO_USER_PROFILE_URL = "https://openapi.zalo.me/v2.0/oa/getprofile"
ZALO_SEND_MSG_URL = "https://openapi.zalo.me/v2.0/oa/message"
ZALO_UPLOAD_FILE_URL = "https://openapi.zalo.me/v2.0/oa/upload/file"
ZALO_UPLOAD_IMAGE_URL = "https://openapi.zalo.me/v2.0/oa/upload/image"


# ── Xác thực Webhook ─────────────────────────────────────────────────────────

def verify_zalo_webhook_signature(request_body: bytes, received_signature: str, app_id: str, timestamp: str, mac_key: str) -> bool:
    """
    Xác thực chữ ký từ Zalo OA Webhook.
    Công thức của Zalo: mac = sha256(appId + data + timestamp + macKey)
    """
    if not received_signature or not mac_key:
        return False
    
    try:
        data_str = request_body.decode("utf-8")
        payload = app_id + data_str + timestamp + mac_key
        expected = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        
        if received_signature.startswith("mac="):
            received_signature = received_signature[4:]
            
        return expected == received_signature
    except Exception as e:
        logger.error(f"Error verifying signature: {e}")
        return False


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

def convert_social_lead(social_lead, phone_number: str, assigned_user=None, customer_name=None, email: str = None, address: str = None):
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

    if social_lead.status == "converted" or social_lead.is_customer_converted:
        # Nếu đã có customer liên kết thì trả về ngay, không raise lỗi khi tự động quét
        if hasattr(social_lead, 'customer') and social_lead.customer:
            return social_lead.customer
        if social_lead.status == "converted":
            raise ValueError(f"SocialLead #{social_lead.id} đã được chuyển đổi thành Customer trước đó.")

    phone_number = normalize_phone(phone_number)
    company = social_lead.company
    final_name = (customer_name or "").strip() or social_lead.display_name or f"Khách Zalo ({social_lead.social_id[-4:]})"
    final_email = (email or social_lead.detected_email or "").strip()
    final_address = (address or social_lead.detected_address or "").strip()

    with transaction.atomic():
        # Cập nhật lại display_name cho social_lead nếu có chỉnh sửa tên
        if final_name != social_lead.display_name:
            social_lead.display_name = final_name

        # Kiểm tra xem SĐT đã tồn tại chưa
        existing_customer = Customer.objects.filter(
            company=company,
            phone=phone_number,
        ).first()

        if existing_customer:
            # MERGE: Gắn social_lead vào customer đã có
            update_fields = ["updated_at"]
            if existing_customer.social_lead is None:
                existing_customer.social_lead = social_lead
                update_fields.append("social_lead")
            if customer_name and customer_name.strip() and existing_customer.name != final_name:
                existing_customer.name = final_name
                update_fields.append("name")
            if final_email and not existing_customer.email:
                existing_customer.email = final_email
                update_fields.append("email")
            if final_address and not existing_customer.address:
                existing_customer.address = final_address
                update_fields.append("address")
            existing_customer.save(update_fields=update_fields)
            customer = existing_customer
            logger.info(
                f"[ZaloConvert] Merged SocialLead #{social_lead.id} "
                f"-> existing Customer #{customer.id} (phone: {phone_number})"
            )
        else:
            # CREATE: Tạo Customer mới từ data của SocialLead
            customer = Customer.objects.create(
                company=company,
                name=final_name,
                phone=phone_number,
                email=final_email,
                address=final_address,
                source="zalo",
                status="new",
                assigned_to=assigned_user or social_lead.assigned_to,
                avatar=social_lead.avatar or "",
            )
            logger.info(f"[ZaloConvert] Created Customer #{customer.id} from SocialLead #{social_lead.id}")

            # Thiết lập quan hệ 1-1
            customer.social_lead = social_lead
            customer.save(update_fields=["social_lead"])

        # Cập nhật trạng thái cho SocialLead
        social_lead.status = "converted"
        social_lead.is_customer_converted = True
        if phone_number and not social_lead.detected_phone:
            social_lead.detected_phone = phone_number
        social_lead.save(update_fields=["status", "is_customer_converted", "detected_phone", "updated_at"])

    return customer


def smart_extract_vn_phone(text: str):
    """
    Thuật toán phát hiện và chuẩn hoá SĐT Việt Nam thông minh.
    - Nhận diện SĐT thiếu 0, có/không có +84, cách khoảng/chấm/gạch ngang
    - Tự động chuẩn hoá về 10 số (0xxxxxxxxx)
    """
    if not text:
        return None

    # Mẫu 1: Có đầu số rõ ràng (0 hoặc +84 hoặc 84) + đầu số nhà mạng VN [35789] + 8 chữ số (cho phép khoảng trắng, dấu chấm, gạch ngang)
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

    # Mẫu 2: Trường hợp khách viết thiếu số 0 ở đầu (9 chữ số bắt đầu bằng 3, 5, 7, 8, 9)
    pattern_implicit = re.compile(
        r'\b([35789](?:[\s\.\-]?\d){8})\b'
    )
    phone_keywords = ['sdt', 'sđt', 'so', 'số', 'phone', 'zalo', 'lh', 'liên hệ', 'gọi', 'alo']
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


def smart_extract_email(text: str):
    """
    Phát hiện và chuẩn hoá địa chỉ email trong tin nhắn.
    """
    if not text:
        return None
    email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b')
    match = email_pattern.search(text)
    if match:
        email = match.group(0).lower().strip()
        if not any(e in email for e in ['@example.', 'noreply@', 'test@']):
            return email
    return None


def smart_extract_address(text: str):
    """
    Nhận diện và trích xuất TRUNG THỰC đoạn địa chỉ giao hàng/nhà riêng trong tin nhắn.
    Cắt bỏ các câu hội thoại giao tiếp không liên quan (chào hỏi, hỏi giá, hỏi địa chỉ shop...).
    """
    if not text:
        return None

    # Loại bỏ các câu hỏi/thoại chung chung về địa chỉ
    ignore_patterns = [
        r'địa\s*chỉ\s*(?:email|shop|bên\s*mình|ở\s*đâu|cty|công\s*ty|nào|để|của|chi\s*tiết|\?)',
        r'(?:xin|hỏi|cho|tìm|qua|biết|gửi|lấy)\s*(?:xin\s*)?địa\s*chỉ',
        r'catalogue.*email|email.*catalogue'
    ]
    
    # 1. Tách văn bản thành các dòng (theo \n)
    raw_lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Bộ từ khóa chỉ đơn vị hành chính/địa điểm VN rõ ràng
    admin_keywords = [
        'số nhà', 'ngõ ', 'ngách ', 'hẻm ', 'đường ', 'phố ',
        'phường', 'p.', 'quận', 'q.', 'huyện', 'h.', 'xã ', 'tỉnh ',
        'thành phố', 'tp.', 'tx.', 'tt.', 'kđt', 'khu đô thị',
        'chung cư', 'toà ', 'tòa ', 'sảnh ', 'bld ', 'block ',
        'hà nội', 'tphcm', 'tp hcm', 'hồ chí minh', 'sài gòn',
        'đà nẵng', 'cần thơ', 'hải phòng', 'bình dương', 'đồng nai',
        'thôn ', 'xóm ', 'ấp '
    ]
    
    prefix_regex = re.compile(r'^(?:.*?\b(?:địa\s*chỉ|đ\/c|d\/c|đc|dc|ship\s*(?:đến|tới|về)?|giao\s*(?:đến|tới|về)?|ở\s*(?:tại)?|nhà\s*số|add|address)\s*[:\-\.]?\s*)', re.IGNORECASE)

    extracted_segments = []

    for line in raw_lines:
        line_low = line.lower()
        if any(re.search(pat, line_low) for pat in ignore_patterns):
            continue

        # Tách dòng dài thành các câu nhỏ hơn nếu có dấu chấm, chấm phẩy hoặc nhiều khoảng trắng
        sub_sentences = [s.strip() for s in re.split(r'[\.\!\?]\s+|\s{2,}', line) if s.strip()]
        
        for sent in sub_sentences:
            sent_low = sent.lower()
            if any(re.search(pat, sent_low) for pat in ignore_patterns):
                continue
            
            # Kiểm tra xem câu có tiền tố địa chỉ rõ ràng không (VD: "Đc: Số 12 Lê Lợi...")
            has_prefix = bool(re.search(r'\b(?:địa\s*chỉ|đ\/c|d\/c|đc|dc|ship\s*(?:đến|tới|về)?|giao\s*(?:đến|tới|về)?|nhà\s*số)\s*[:\-\.]', sent_low))
            
            if has_prefix:
                clean_addr = prefix_regex.sub('', sent).strip()
                # Loại bỏ SĐT nếu dính trong câu địa chỉ
                clean_addr = re.sub(r'\b(?:0|\+84)[35789]\d{8}\b', '', clean_addr).strip(' .,:-')
                if len(clean_addr) >= 6 and any(c.isalpha() for c in clean_addr):
                    extracted_segments.append(clean_addr)
            else:
                matching_kws = [kw for kw in admin_keywords if kw in sent_low]
                # Từ khóa mạnh (thêm thành phố lớn, ngõ, ngách, đường, thôn...)
                strong_kws = [
                    'số nhà', 'chung cư', 'khu đô thị', 'kđt', 'phường', 'quận', 'huyện',
                    'thành phố', 'tp.', 'tỉnh', 'hà nội', 'tphcm', 'tp hcm', 'hồ chí minh',
                    'sài gòn', 'đà nẵng', 'cần thơ', 'hải phòng', 'hn', 'hcm',
                    'thôn ', 'xóm ', 'ấp ', 'ngõ ', 'ngách ', 'hẻm ', 'đường ', 'phố '
                ]
                has_strong = any(skw in sent_low for skw in strong_kws)
                
                # Kiểm tra cấu trúc số nhà đứng đầu (VD: "220 định công, hà nội")
                starts_with_house_number = bool(re.match(r'^\d{1,4}(?:[\/-]\d{1,4})*\s+[A-Za-zĐđÂâĂăÊêÔôƠơƯưÁáÀàẠạẢảÃã]', sent.strip()))
                has_comma_or_admin = (',' in sent) or (len(matching_kws) >= 1)
                
                if len(matching_kws) >= 2 or (has_strong and len(sent) >= 8) or (starts_with_house_number and has_comma_or_admin and len(sent) >= 8):
                    clean_addr = re.sub(r'\b(?:0|\+84)[35789]\d{8}\b', '', sent).strip(' .,:-')
                    if len(clean_addr) >= 6 and any(c.isalpha() for c in clean_addr):
                        if not any(w in sent_low for w in ['ko ak', 'được ko', 'khi nào', 'hay sao vậy', 'muốn mua', 'hết hàng', 'giá bao nhiêu', 'bán cho', 'lít mật ong', 'kg ', 'gram ']):
                            extracted_segments.append(clean_addr)

    if extracted_segments:
        unique_segments = []
        for seg in extracted_segments:
            if not any(seg.lower() in u.lower() for u in unique_segments):
                unique_segments.append(seg)
        result = ". ".join(unique_segments)
        return result[:300] if len(result) >= 6 else None
    return None


def extract_and_process_phone(social_lead, text: str):
    """
    Quét SĐT, Email và Địa chỉ trong tin nhắn Zalo với thuật toán thông minh.
    """
    if not text:
        return None

    updated = False
    norm_phone = smart_extract_vn_phone(text)
    detected_email = smart_extract_email(text)
    detected_address = smart_extract_address(text)

    if detected_email and (not social_lead.detected_email or detected_email != social_lead.detected_email):
        social_lead.detected_email = detected_email
        updated = True

    if social_lead.detected_address != detected_address:
        social_lead.detected_address = detected_address
        updated = True

    if norm_phone:
        if not (social_lead.is_customer_converted or hasattr(social_lead, 'customer')) and not (social_lead.detected_phone and social_lead.detected_phone != norm_phone):
            if not social_lead.detected_phone:
                social_lead.detected_phone = norm_phone
                updated = True

            from crm.models import Customer
            company = social_lead.company
            already_exists = Customer.objects.filter(company=company, phone=norm_phone).exists()
            auto_create = social_lead.oa_config.auto_create_customer_from_phone if social_lead.oa_config else False

            if already_exists:
                existing_customer = Customer.objects.filter(company=company, phone=norm_phone).first()
                social_lead.is_customer_converted = True
                if existing_customer.social_lead is None:
                    existing_customer.social_lead = social_lead
                    existing_customer.save(update_fields=["social_lead", "updated_at"])
                updated = True
            elif auto_create and social_lead.status != "converted":
                try:
                    convert_social_lead(social_lead, norm_phone)
                    logger.info(f"[ZaloAutoScan] Tự động tạo khách hàng từ SĐT {norm_phone} của Lead #{social_lead.id}")
                except Exception as e:
                    logger.error(f"[ZaloAutoScan] Lỗi tự động tạo KH từ SĐT {norm_phone}: {e}")
                    updated = True
            else:
                social_lead.is_customer_converted = False
                updated = True

    if hasattr(social_lead, 'customer') and social_lead.customer:
        customer = social_lead.customer
        cust_updated = False
        if social_lead.detected_email and not customer.email:
            customer.email = social_lead.detected_email
            cust_updated = True
        if social_lead.detected_address and not customer.address:
            customer.address = social_lead.detected_address
            cust_updated = True
        if cust_updated:
            customer.save(update_fields=["email", "address", "updated_at"])

    if updated:
        update_f = ["detected_email", "detected_address", "updated_at"]
        if social_lead.detected_phone:
            update_f.append("detected_phone")
        if social_lead.is_customer_converted:
            update_f.append("is_customer_converted")
        social_lead.save(update_fields=list(set(update_f)))

    return norm_phone or social_lead.detected_phone


# ── Lấy Thông tin Zalo OA từ Open API ─────────────────────────────────────────

def fetch_zalo_oa_info(access_token: str):
    """
    Gọi Zalo Open API để lấy thông tin OA hiện tại tương ứng với access_token.
    Returns: dict {"oa_id": str, "name": str, "avatar": str} hoặc None
    """
    if not access_token:
        return None
    try:
        url = "https://openapi.zalo.me/v2.0/oa/getoa"
        headers = {"access_token": access_token}
        resp = requests.get(url, headers=headers, timeout=10)
        data = resp.json()
        if data.get("error") == 0 and "data" in data:
            oa_data = data["data"]
            return {
                "oa_id": str(oa_data.get("oa_id", "")),
                "name": oa_data.get("name", ""),
                "avatar": oa_data.get("avatar", "")
            }
    except Exception as e:
        logger.error(f"Error fetching Zalo OA info: {e}")
    return None


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
                "app_id": oa_config.get_app_id(),
                "grant_type": "refresh_token",
                "refresh_token": oa_config.refresh_token,
            },
            headers={"secret_key": oa_config.get_secret_key()},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        if "access_token" not in data:
            logger.error(f"[ZaloToken] Refresh failed for '{oa_config.oa_name}': {data}")
            oa_config._last_refresh_error = data.get("error_name") or data.get("error_description") or str(data)
            return False

        expires_in = int(data.get("expires_in", 86400))
        oa_config.access_token = data["access_token"]
        oa_config.refresh_token = data.get("refresh_token", oa_config.refresh_token)
        oa_config.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
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


def upload_image_to_zalo(oa_config, file_obj) -> str:
    """
    Upload hình ảnh lên Zalo để lấy attachment_id.
    """
    if oa_config.is_token_near_expiry:
        refresh_zalo_access_token(oa_config)
        oa_config.refresh_from_db()

    try:
        response = requests.post(
            ZALO_UPLOAD_IMAGE_URL,
            headers={"access_token": oa_config.access_token},
            files={"file": (file_obj.name, file_obj, file_obj.content_type)},
            timeout=30,
        )
        response.raise_for_status()
        res_data = response.json()
        if res_data.get("error") == 0:
            return res_data.get("data", {}).get("attachment_id", "")
        logger.error(f"[ZaloUploadImage] Error: {res_data}")
        return ""
    except Exception as e:
        logger.error(f"[ZaloUploadImage] Exception: {e}")
        return ""


def send_zalo_chat_message(oa_config, zalo_uid: str, text: str = "", file_token: str = "", image_id: str = "", request_phone: bool = False) -> dict:
    """
    Gửi tin nhắn chat thông thường tới Zalo User (Text hoặc File).
    Nếu request_phone=True, gửi yêu cầu chia sẻ số điện thoại.
    """
    if oa_config.is_token_near_expiry:
        refresh_zalo_access_token(oa_config)
        oa_config.refresh_from_db()

    payload = {"recipient": {"user_id": zalo_uid}, "message": {}}

    if request_phone:
        payload["message"] = {
            "text": text or "Vui lòng chia sẻ số điện thoại để chúng tôi có thể liên hệ hỗ trợ tốt nhất.",
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "request_user_info",
                    "elements": [{
                        "title": "Chia sẻ số điện thoại",
                        "subtitle": "Đồng ý chia sẻ số điện thoại của bạn với OA",
                        "image_url": ""
                    }]
                }
            }
        }
    elif image_id:
        payload["message"]["attachment"] = {
            "type": "template",
            "payload": {
                "template_type": "media",
                "elements": [{
                    "media_type": "image",
                    "attachment_id": image_id
                }]
            }
        }
        if text:
            payload["message"]["text"] = text
    elif file_token:
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
        import json
        data_param = json.dumps({"user_id": zalo_user_id})
        response = requests.get(
            ZALO_USER_PROFILE_URL,
            params={"data": data_param},
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
