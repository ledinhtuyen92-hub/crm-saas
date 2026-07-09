import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from orders.models import Order
from approvals.models import ApprovalRequest, ApprovalStep
from django.contrib.contenttypes.models import ContentType
from users.models import User

# Get the last order that was created
order = Order.objects.order_by('id').last()
print('Testing Order ID:', order.id)

# Get the admin user
user = User.objects.filter(is_company_admin=True).first() or User.objects.first()
print('Testing with user:', user)

ct = ContentType.objects.get_for_model(order)

try:
    req = ApprovalRequest.objects.create(
        company=order.company,
        content_type=ct,
        object_id=order.id,
        requester=user,
        title=f'Phê duyệt Đơn hàng {order.order_number}',
        description=f'Đơn hàng {order.order_number}',
        status=ApprovalRequest.STATUS_PENDING,
    )
    print('Req created:', req.id)
    step = ApprovalStep.objects.create(
        request=req,
        step_order=1,
        status=ApprovalStep.STATUS_PENDING,
    )
    print('Step created:', step.id)
except Exception as e:
    import traceback
    traceback.print_exc()
