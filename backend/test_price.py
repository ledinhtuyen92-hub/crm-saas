import os
import django
import sys

sys.path.append(r'G:\(A) CAI LAP TRINH\Projects\crm-saas\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from inventory.models import Product
print("---PRODUCTS---")
for p in Product.objects.all()[:5]:
    print(p.id, repr(p.name), repr(p.price), type(p.price))
print("--------------")
