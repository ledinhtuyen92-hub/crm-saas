import os
import django
import sys

sys.path.append(r'G:\(A) CAI LAP TRINH\Projects\crm-saas\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from inventory.models import Product
from inventory.serializers import ProductSerializer

prods = Product.objects.all()[:2]
data = ProductSerializer(prods, many=True).data
print(data)
