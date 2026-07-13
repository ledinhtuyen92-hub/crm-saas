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
    không có tương tác trong 30 ngày qua.

    Dùng soft-delete (đổi status -> 'archived') thay vì xóa cứng
    để giữ audit trail và tránh mất data quan trọng.

    Chạy lúc 3 giờ sáng mỗi ngày qua Celery Beat.
    """
    from zalo_integration.models import SocialLead

    cutoff_date = timezone.now() - timedelta(days=30)

    stale_leads = SocialLead.objects.filter(
        status__in=[SocialLead.STATUS_NEW, SocialLead.STATUS_CHATTING],
        last_interaction_date__lt=cutoff_date,
    )

    count = stale_leads.count()
    logger.info(f"[ZaloTask:CleanupLeads] Tìm thấy {count} SocialLead không hoạt động (> 30 ngày).")

    if count > 0:
        updated = stale_leads.update(status=SocialLead.STATUS_ARCHIVED)
        logger.info(f"[ZaloTask:CleanupLeads] ✅ Đã archive {updated} SocialLead.")
    else:
        logger.info("[ZaloTask:CleanupLeads] ✅ Database sạch sẽ, không cần cleanup.")

    return {"archived_count": count}


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
