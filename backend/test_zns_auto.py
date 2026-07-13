import os
import django
from datetime import timezone as dt_timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.utils import timezone
from zalo_integration.models import ZaloOaConfig, ZaloMessageTemplate, ZaloMessageLog
from crm.models import Customer
from orders.models import Order
from finance.models import PaymentReceipt
from users.models import Company
from zalo_integration.tasks import send_birthday_zns_to_customers

print("--- KIỂM TRA TỰ ĐỘNG GỬI ZNS ---")

company = Company.objects.first()

# 1. Bật toàn bộ tính năng tự động gửi ZNS
config, _ = ZaloOaConfig.objects.get_or_create(company=company, defaults={'oa_name': 'Test OA', 'app_id': '123'})
config.auto_send_birthday_zns = True
config.auto_send_payment_zns = True
config.auto_send_delivery_zns = True
config.is_active = True
config.save()
print(f"[1] Đã bật 3 nút tự động gửi ZNS cho công ty {company.name}")

# 2. Tạo template mẫu nếu chưa có
for t_type in [ZaloMessageTemplate.TYPE_BIRTHDAY, ZaloMessageTemplate.TYPE_CARE, ZaloMessageTemplate.TYPE_ORDER_CONFIRM]:
    ZaloMessageTemplate.objects.get_or_create(
        company=company,
        template_type=t_type,
        defaults={'zalo_template_id': f'TMP_{t_type}', 'name': f'Mẫu {t_type}', 'is_active': True}
    )
print("[2] Đã tạo các mẫu ZNS (Birthday, Care, Order Confirm)")

# 3. Test tự động chúc mừng sinh nhật
customer = Customer.objects.filter(company=company).first()
if customer:
    customer.birthday = timezone.now().date()
    customer.phone = "0987654321" if not customer.phone else customer.phone
    customer.save()
    print(f"[3] Đã cài ngày sinh của khách hàng '{customer.name}' thành hôm nay.")
    
    # Chạy task quét sinh nhật
    res = send_birthday_zns_to_customers()
    print(f"    Kết quả chạy Task sinh nhật: {res}")

# 4. Test tự động gửi ZNS hoàn thành đơn hàng
order = Order.objects.filter(company=company).first()
if order:
    print(f"[4] Đang thử chuyển đơn hàng '{order.order_number}' sang trạng thái PENDING rồi COMPLETED...")
    order.status = Order.STATUS_PENDING
    order.save()
    order.status = Order.STATUS_COMPLETED
    order.save()

# 5. Test tự động gửi ZNS thu tiền
import random
print(f"[5] Đang tạo phiếu thu mới để test ZNS thu tiền...")
receipt = PaymentReceipt.objects.filter(company=company).first()
if receipt:
    new_receipt = PaymentReceipt.objects.create(
        company=company,
        order=receipt.order,
        milestone=receipt.milestone,
        receipt_code=f"PT-TEST-{random.randint(1000, 9999)}",
        amount=100000,
        payment_method='cash'
    )


print("\n--- KẾT QUẢ CÁC TIN NHẮN ZNS ĐƯỢC TẠO TỰ ĐỘNG ---")
logs = ZaloMessageLog.objects.all().order_by('-sent_at')[:5]
for log in logs:
    sent_at_str = log.sent_at.strftime('%Y-%m-%d %H:%M:%S') if log.sent_at else 'N/A'
    print(f"- Ngày: {sent_at_str} | Gửi đến: {log.recipient_phone} | Trạng thái: {log.get_status_display()} | Params: {log.params_sent}")


