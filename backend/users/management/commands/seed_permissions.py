from django.core.management.base import BaseCommand

from users.models import Permission


# Bộ permissions chuẩn theo module
PERMISSIONS = [
    # ── Dashboard ──────────────────────────────────────────
    {"code": "dashboard.view", "name": "Xem Dashboard", "module": "dashboard"},

    # ── CRM (Khách hàng) ────────────────────────────────────
    {"code": "crm.view", "name": "Xem danh sách khách hàng", "module": "crm"},
    {"code": "crm.create", "name": "Thêm khách hàng mới", "module": "crm"},
    {"code": "crm.edit", "name": "Chỉnh sửa thông tin khách hàng", "module": "crm"},
    {"code": "crm.delete", "name": "Xóa khách hàng", "module": "crm"},
    {"code": "crm.export", "name": "Xuất dữ liệu khách hàng", "module": "crm"},

    # ── Sales (Bán hàng) ────────────────────────────────────
    {"code": "sales.view", "name": "Xem danh sách bán hàng", "module": "sales"},
    {"code": "sales.create", "name": "Tạo đơn bán hàng", "module": "sales"},
    {"code": "sales.edit", "name": "Chỉnh sửa đơn bán hàng", "module": "sales"},
    {"code": "sales.delete", "name": "Xóa đơn bán hàng", "module": "sales"},
    {"code": "sales.approve", "name": "Duyệt đơn bán hàng", "module": "sales"},
    {"code": "sales.export", "name": "Xuất dữ liệu bán hàng", "module": "sales"},

    # ── Orders (Đơn hàng) ───────────────────────────────────
    {"code": "orders.view", "name": "Xem danh sách đơn hàng", "module": "orders"},
    {"code": "orders.create", "name": "Tạo đơn hàng", "module": "orders"},
    {"code": "orders.edit", "name": "Chỉnh sửa đơn hàng", "module": "orders"},
    {"code": "orders.delete", "name": "Xóa đơn hàng", "module": "orders"},
    {"code": "orders.approve", "name": "Duyệt đơn hàng", "module": "orders"},

    # ── Inventory (Kho bãi) ─────────────────────────────────
    {"code": "inventory.view", "name": "Xem tồn kho", "module": "inventory"},
    {"code": "inventory.create", "name": "Nhập kho", "module": "inventory"},
    {"code": "inventory.edit", "name": "Chỉnh sửa phiếu kho", "module": "inventory"},
    {"code": "inventory.delete", "name": "Xóa phiếu kho", "module": "inventory"},
    {"code": "inventory.export", "name": "Xuất kho", "module": "inventory"},

    # ── Production (Sản xuất) ───────────────────────────────
    {"code": "production.view", "name": "Xem tiến độ sản xuất", "module": "production"},
    {"code": "production.create", "name": "Tạo lệnh sản xuất", "module": "production"},
    {"code": "production.edit", "name": "Chỉnh sửa lệnh sản xuất", "module": "production"},
    {"code": "production.delete", "name": "Xóa lệnh sản xuất", "module": "production"},

    # ── Reports (Báo cáo) ───────────────────────────────────
    {"code": "reports.view", "name": "Xem báo cáo", "module": "reports"},
    {"code": "reports.export", "name": "Xuất báo cáo", "module": "reports"},

    # ── Settings (Cài đặt công ty) ──────────────────────────
    {"code": "settings.users", "name": "Quản lý nhân viên", "module": "settings"},
    {"code": "settings.roles", "name": "Quản lý vai trò & phân quyền", "module": "settings"},
    {"code": "settings.company", "name": "Cài đặt thông tin công ty", "module": "settings"},
]


class Command(BaseCommand):
    help = "Seed danh sách permissions mặc định cho toàn bộ module CRM SaaS."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for perm_data in PERMISSIONS:
            obj, created = Permission.objects.update_or_create(
                code=perm_data["code"],
                defaults={"name": perm_data["name"], "module": perm_data["module"]},
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"✅ Hoàn thành! Đã tạo mới {created_count} và cập nhật {updated_count} permissions."
            )
        )
