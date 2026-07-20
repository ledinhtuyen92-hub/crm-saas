"""
zalo_integration/tasks.py
Celery background tasks cho module Zalo Integration.

Lịch chạy (cấu hình trong settings.py CELERY_BEAT_SCHEDULE):
- refresh_all_zalo_tokens   : Mỗi 12 giờ
- cleanup_stale_leads       : 3 giờ sáng mỗi ngày
- send_zns_task             : On-demand (triggered bởi user action)
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


# ── Task 1: Auto-Refresh tất cả Access Tokens ────────────────────────────────

@shared_task(name="zalo.refresh_all_tokens", bind=True, max_retries=0)
def refresh_all_zalo_tokens(self):
    """
    Quét tất cả ZaloOaConfig còn active.
    Nếu token sắp hết hạn (< 2 giờ) -> gọi Zalo API để refresh.
    Chạy mỗi 12 giờ qua Celery Beat.
    """
    from zalo_integration.models import ZaloOaConfig
    from zalo_integration.services import refresh_zalo_access_token

    configs = ZaloOaConfig.objects.filter(
        is_active=True,
        refresh_token__isnull=False,
    ).exclude(refresh_token="")

    total = configs.count()
    refreshed = 0
    failed = 0

    logger.info(f"[ZaloTask:RefreshTokens] Bắt đầu kiểm tra {total} OA config(s)...")

    for config in configs:
        if config.is_token_near_expiry:
            logger.info(f"[ZaloTask:RefreshTokens] Token sắp hết hạn, refresh OA: '{config.oa_name}'...")
            success = refresh_zalo_access_token(config)
            if success:
                refreshed += 1
            else:
                failed += 1

    result = {
        "total_configs": total,
        "refreshed": refreshed,
        "failed": failed,
        "skipped": total - refreshed - failed,
    }
    logger.info(f"[ZaloTask:RefreshTokens] Hoàn tất: {result}")
    return result


# ── Task 2: Auto-Cleanup Stale Social Leads ───────────────────────────────────

@shared_task(name="zalo.cleanup_stale_leads", bind=True, max_retries=0)
def cleanup_stale_social_leads(self):
    """
    Archive SocialLead ở trạng thái 'new' hoặc 'chatting' mà
    không có tương tác trong X ngày qua (X cấu hình theo công ty).

    Dùng soft-delete (đổi status -> 'archived') thay vì xóa cứng
    để giữ audit trail và tránh mất data quan trọng.

    Chạy lúc 3 giờ sáng mỗi ngày qua Celery Beat.
    """
    from zalo_integration.models import SocialLead, ZaloOaConfig

    configs = ZaloOaConfig.objects.filter(is_active=True)
    total_archived = 0

    for config in configs:
        cutoff_date = timezone.now() - timedelta(days=config.lead_cleanup_days)
        
        stale_leads = SocialLead.objects.filter(
            company=config.company,
            status__in=[SocialLead.STATUS_NEW, SocialLead.STATUS_CHATTING],
            last_interaction_date__lt=cutoff_date,
        )

        count = stale_leads.count()
        if count > 0:
            updated = stale_leads.update(status=SocialLead.STATUS_ARCHIVED)
            total_archived += updated
            logger.info(f"[ZaloTask:CleanupLeads] Công ty {config.company.name}: Đã archive {updated} SocialLead (> {config.lead_cleanup_days} ngày).")

    if total_archived == 0:
        logger.info("[ZaloTask:CleanupLeads] ✅ Database sạch sẽ, không có lead nào cần cleanup.")

    return {"archived_count": total_archived}


# ── Task 3: Gửi ZNS (On-demand) ──────────────────────────────────────────────

@shared_task(
    name="zalo.send_zns",
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # Retry sau 60 giây
)
def send_zns_task(self, log_id: int):
    """
    Gửi ZNS dựa trên ZaloMessageLog record đã được tạo sẵn.
    Được trigger từ View khi user bấm nút "Gửi ZNS".

    Retry logic:
    - Lần 1 retry: sau 60 giây
    - Lần 2 retry: sau 120 giây
    - Lần 3 retry: sau 180 giây
    - Sau 3 lần: đánh dấu log là FAILED.
    """
    from zalo_integration.services import send_zns_message

    logger.info(f"[ZaloTask:SendZNS] Bắt đầu gửi ZNS log_id={log_id}...")

    try:
        success = send_zns_message(log_id)
        if success:
            logger.info(f"[ZaloTask:SendZNS] ✅ Gửi thành công log_id={log_id}")
        else:
            logger.warning(f"[ZaloTask:SendZNS] ⚠️ Gửi thất bại log_id={log_id}")
            # Retry nếu còn lượt
            raise self.retry(
                exc=Exception(f"ZNS send failed for log_id={log_id}"),
                countdown=60 * (self.request.retries + 1),
            )
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            logger.error(f"[ZaloTask:SendZNS] ❌ Hết lượt retry cho log_id={log_id}: {exc}")
            # Đánh dấu thất bại cuối cùng
            from zalo_integration.models import ZaloMessageLog
            ZaloMessageLog.objects.filter(id=log_id).update(
                status=ZaloMessageLog.STATUS_FAILED,
                error_message=f"Thất bại sau {self.max_retries} lần thử: {str(exc)}",
            )
        else:
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))

    return {"log_id": log_id, "success": success}


# ── Task 4: Gửi ZNS Chúc mừng sinh nhật tự động ─────────────────────────────

@shared_task(
    name="zalo.send_birthday_zns",
    bind=True,
    max_retries=1,
)
def send_birthday_zns_to_customers(self):
    """
    Quét tất cả các Khách hàng có ngày sinh là hôm nay.
    Nếu công ty của khách hàng có bật `auto_send_birthday_zns`, 
    sẽ tìm mẫu ZNS loại `birthday` và gửi đi.
    """
    from django.utils import timezone
    from zalo_integration.models import ZaloOaConfig, ZaloMessageTemplate, ZaloMessageLog
    from crm.models import Customer
    from zalo_integration.services import send_zns_message
    
    logger.info("[ZaloTask:SendBirthdayZNS] Bắt đầu quét khách hàng sinh nhật hôm nay...")
    
    today = timezone.now().date()
    
    # Kiểm tra chế độ bảo trì toàn hệ thống
    from users.models import SystemSettings
    if SystemSettings.load().maintenance_mode:
        logger.info("[ZaloTask:SendBirthdayZNS] Hệ thống đang ở chế độ bảo trì, tạm dừng tự động gửi ZNS sinh nhật.")
        return {"success": True, "sent_count": 0}

    # 1. Tìm các cấu hình OA có bật tự động gửi sinh nhật và đang active
    configs = ZaloOaConfig.objects.filter(is_active=True, auto_send_birthday_zns=True).select_related('company')
    if not configs.exists():
        logger.info("[ZaloTask:SendBirthdayZNS] Không có công ty nào bật tính năng này.")
        return {"success": True, "sent_count": 0}

    valid_company_ids = []
    for config in configs:
        company = config.company
        if not company or not company.is_active:
            continue
        if not hasattr(company, "settings") or not company.settings:
            continue
        if "zalo" not in (company.settings.active_modules or []):
            continue
        valid_company_ids.append(company.id)

    if not valid_company_ids:
        logger.info("[ZaloTask:SendBirthdayZNS] Không có công ty hợp lệ (hoặc module Zalo bị tắt).")
        return {"success": True, "sent_count": 0}
    
    # 2. Tìm các Customer có sinh nhật hôm nay thuộc các công ty hợp lệ đó
    birthday_customers = Customer.objects.filter(
        company_id__in=valid_company_ids,
        birthday__day=today.day,
        birthday__month=today.month,
        phone__isnull=False
    ).exclude(phone="")
    
    if not birthday_customers.exists():
        logger.info("[ZaloTask:SendBirthdayZNS] Không có khách hàng nào sinh nhật hôm nay.")
        return {"success": True, "sent_count": 0}

    sent_count = 0
    for customer in birthday_customers:
        # Chống gửi lặp lại trong cùng ngày hôm nay cho khách hàng
        if ZaloMessageLog.objects.filter(
            company_id=customer.company_id,
            customer=customer,
            template__template_type=ZaloMessageTemplate.TYPE_BIRTHDAY,
            sent_at__date=today
        ).exists():
            logger.info(f"[ZaloTask:SendBirthdayZNS] Khách hàng #{customer.id} ({customer.phone}) đã được gửi ZNS chúc mừng sinh nhật hôm nay.")
            continue

        # Tìm template birthday của công ty
        template = ZaloMessageTemplate.objects.filter(
            company_id=customer.company_id,
            template_type=ZaloMessageTemplate.TYPE_BIRTHDAY,
            is_active=True
        ).first()
        
        if not template:
            logger.warning(f"[ZaloTask:SendBirthdayZNS] Cty {customer.company_id} chưa có mẫu ZNS sinh nhật.")
            continue
            
        # Tạo ZaloMessageLog
        log = ZaloMessageLog.objects.create(
            company_id=customer.company_id,
            template=template,
            customer=customer,
            recipient_phone=customer.phone,
            params_sent={
                "customer_name": customer.name or "Quý khách",
                # Các tham số khác có thể thêm nếu mẫu yêu cầu
            },
            status=ZaloMessageLog.STATUS_PENDING
        )
        
        # Gửi ZNS
        try:
            success = send_zns_message(log.id)
            if success:
                sent_count += 1
        except Exception as e:
            logger.error(f"[ZaloTask:SendBirthdayZNS] Lỗi gửi cho {customer.phone}: {str(e)}")

    logger.info(f"[ZaloTask:SendBirthdayZNS] Hoàn thành. Đã gửi {sent_count} ZNS sinh nhật.")
    return {"success": True, "sent_count": sent_count}
