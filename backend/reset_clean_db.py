"""
Script: reset_clean_db.py
Xóa toàn bộ dữ liệu database để thiết lập lại từ đầu, chỉ giữ lại tài khoản admin hệ thống và các cài đặt cốt lõi (permissions, gói SaaS).
Chạy: docker exec crm_web python reset_clean_db.py
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, '/app')
django.setup()

from django.core.management import call_command
from django.db import transaction
from django.contrib.auth import get_user_model
from users.models import Permission, SubscriptionPlan, SystemSettings, Company

User = get_user_model()

print("=" * 60)
print("🗑️  Bước 1: Xóa toàn bộ dữ liệu cơ sở dữ liệu (flush)...")
print("=" * 60)

call_command('flush', '--no-input', verbosity=0)
print("✅ Đã xóa sạch toàn bộ dữ liệu!")

print()
print("=" * 60)
print("⚙️  Bước 2: Khởi tạo lại quyền hạn chuẩn (RBAC Permissions)...")
print("=" * 60)
call_command('seed_permissions', verbosity=1)

print()
print("=" * 60)
print("📦 Bước 3: Khởi tạo các Gói dịch vụ SaaS chuẩn...")
print("=" * 60)
with transaction.atomic():
    plans_data = [
        ("starter",      "Gói Starter",      5,     True),
        ("standard",     "Gói Standard",     15,    True),
        ("business",     "Gói Business",     30,    True),
        ("professional", "Gói Professional", 50,    True),
        ("enterprise",   "Gói Enterprise",   100,   True),
        ("vip",          "Gói VIP Unlimited", 99999, True),
    ]
    for code, name, limit, is_default in plans_data:
        SubscriptionPlan.objects.get_or_create(
            code=code,
            defaults={"name": name, "user_limit": limit, "is_default": is_default},
        )
print(f"✅ Đã khởi tạo {SubscriptionPlan.objects.count()} gói dịch vụ SaaS.")

print()
print("=" * 60)
print("👤 Bước 4: Tạo tài khoản Superuser Quản trị nền tảng SaaS (Admin)...")
print("=" * 60)
with transaction.atomic():
    admin_user, created = User.objects.get_or_create(
        username="admin",
        defaults={
            "email": "admin@saas-platform.vn",
            "full_name": "SaaS System Administrator",
            "company": None,
            "role": None,
            "is_company_admin": False,
            "is_superuser": True,
            "is_staff": True,
            "is_active": True,
        },
    )
    admin_user.company = None
    admin_user.role = None
    admin_user.is_company_admin = False
    admin_user.is_superuser = True
    admin_user.is_staff = True
    admin_user.is_active = True
    admin_user.set_password("admin")
    admin_user.save()

print(f"✅ Tài khoản Quản trị hệ thống đã sẵn sàng:")
print(f"   - Username : admin")
print(f"   - Password : admin")
print(f"   - Superuser: {admin_user.is_superuser}")
print(f"   - Company  : {admin_user.company}")

print()
print("=" * 60)
print("📊 THỐNG KÊ SAU KHI LÀM SẠCH:")
print(f"   - Tổng số Công ty (Tenants): {Company.objects.count()}")
print(f"   - Tổng số Người dùng (Users): {User.objects.count()}")
print(f"   - Tổng số Gói dịch vụ (Plans): {SubscriptionPlan.objects.count()}")
print(f"   - Tổng số Quyền hệ thống   : {Permission.objects.count()}")
print("=" * 60)
print("🎉 HOÀN TẤT! Hệ thống đã được làm sạch 100%, sẵn sàng thiết lập lại từ đầu!")
print("=" * 60)
