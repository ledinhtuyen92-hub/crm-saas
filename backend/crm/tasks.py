import logging
from datetime import timedelta
from django.utils import timezone
from celery import shared_task
from django.db.models import Max
from users.models import CompanySettings
from crm.models import Customer
from orders.models import Order

logger = logging.getLogger(__name__)

@shared_task
def check_and_update_inactive_customers():
    """
    Quét mỗi đêm: Tự động đánh dấu is_inactive = True cho khách hàng
    nếu số ngày không có đơn hàng vượt quá inactive_days_threshold.
    """
    logger.info("Starting check_and_update_inactive_customers...")
    
    # Duyệt qua các cấu hình công ty có threshold > 0
    settings = CompanySettings.objects.filter(inactive_days_threshold__gt=0)
    
    total_updated = 0
    now = timezone.now()
    
    for setting in settings:
        threshold_days = setting.inactive_days_threshold
        company = setting.company
        
        # Chỉ xét các khách hàng không ở trạng thái lost/inactive và chưa bị đánh dấu is_inactive
        customers = Customer.objects.filter(
            company=company,
            is_inactive=False
        ).exclude(
            status__in=[Customer.STATUS_LOST, Customer.STATUS_INACTIVE]
        )
        
        for customer in customers:
            # Tìm ngày đơn hàng duyệt gần nhất
            last_order = Order.objects.filter(
                customer=customer, 
                status=Order.STATUS_APPROVED
            ).aggregate(Max('created_at'))['created_at__max']
            
            # Nếu không có đơn hàng nào, lấy ngày tạo khách hàng
            if not last_order:
                last_active_date = customer.created_at
            else:
                last_active_date = last_order
                
            if last_active_date:
                days_since_active = (now - last_active_date).days
                if days_since_active > threshold_days:
                    customer.is_inactive = True
                    customer.save(update_fields=['is_inactive'])
                    total_updated += 1
                    logger.info(f"Customer {customer.id} marked as inactive. Last active: {days_since_active} days ago.")
                    
    logger.info(f"Finished check_and_update_inactive_customers. Total updated: {total_updated}")
    return total_updated
