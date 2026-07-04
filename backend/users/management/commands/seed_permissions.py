from django.core.management.base import BaseCommand

from users.models import Permission


# Bộ permissions chuẩn theo module — đồng bộ với AI_CONTEXT.md
PERMISSIONS = [
    # ── Dashboard ──────────────────────────────────────────────────
    {"code": "dashboard.view", "name": "Xem Dashboard", "module": "dashboard"},

    # ── CRM (Khách hàng & Leads) ───────────────────────────────────
    {"code": "crm.view", "name": "Xem danh sách khách hàng", "module": "crm"},
    {"code": "crm.create", "name": "Thêm khách hàng mới", "module": "crm"},
    {"code": "crm.edit", "name": "Chỉnh sửa thông tin khách hàng", "module": "crm"},
    {"code": "crm.delete", "name": "Xóa khách hàng", "module": "crm"},
    {"code": "crm.assign", "name": "Phân công / Gán khách hàng cho nhân viên", "module": "crm"},
    {"code": "crm.import", "name": "Import khách hàng từ Excel", "module": "crm"},
    {"code": "crm.export", "name": "Xuất danh sách khách hàng", "module": "crm"},
    {"code": "crm.view_all", "name": "Xem tất cả khách hàng (không giới hạn bởi phân công)", "module": "crm"},
    {"code": "crm.manage_tags", "name": "Quản lý Tags khách hàng", "module": "crm"},

    # ── Sales (Báo giá) ───────────────────────────────────────────
    {"code": "sales.view", "name": "Xem danh sách báo giá", "module": "sales"},
    {"code": "sales.create", "name": "Tạo báo giá mới", "module": "sales"},
    {"code": "sales.edit", "name": "Chỉnh sửa báo giá", "module": "sales"},
    {"code": "sales.delete", "name": "Xóa báo giá", "module": "sales"},
    {"code": "sales.export_pdf", "name": "Xuất PDF báo giá", "module": "sales"},

    # ── Orders (Đơn hàng) ─────────────────────────────────────────
    {"code": "orders.view", "name": "Xem danh sách đơn hàng", "module": "orders"},
    {"code": "orders.create", "name": "Tạo đơn hàng mới", "module": "orders"},
    {"code": "orders.edit", "name": "Chỉnh sửa đơn hàng", "module": "orders"},
    {"code": "orders.delete", "name": "Xóa đơn hàng", "module": "orders"},
    {"code": "orders.approve", "name": "Duyệt / Từ chối đơn hàng", "module": "orders"},
    {"code": "orders.export_pdf", "name": "Xuất PDF đơn hàng", "module": "orders"},
    {"code": "orders.view_all", "name": "Xem tất cả đơn hàng (không giới hạn bởi người tạo)", "module": "orders"},

    # ── Inventory (Sản phẩm & Kho vận) ───────────────────────────
    {"code": "inventory.view", "name": "Xem danh sách sản phẩm & tồn kho", "module": "inventory"},
    {"code": "inventory.create_product", "name": "Thêm sản phẩm mới", "module": "inventory"},
    {"code": "inventory.edit_product", "name": "Chỉnh sửa sản phẩm", "module": "inventory"},
    {"code": "inventory.delete_product", "name": "Xóa sản phẩm", "module": "inventory"},
    {"code": "inventory.import", "name": "Nhập hàng vào kho (tạo phiếu nhập)", "module": "inventory"},
    {"code": "inventory.adjust", "name": "Điều chỉnh tồn kho", "module": "inventory"},
    {"code": "inventory.export", "name": "Xem phiếu xuất kho", "module": "inventory"},
    {"code": "inventory.manage_warehouse", "name": "Quản lý kho hàng", "module": "inventory"},
    {"code": "inventory.manage_categories", "name": "Quản lý loại sản phẩm", "module": "inventory"},

    # ── Production (Sản xuất) ─────────────────────────────────────
    {"code": "production.view", "name": "Xem lệnh sản xuất", "module": "production"},
    {"code": "production.create", "name": "Tạo lệnh sản xuất", "module": "production"},
    {"code": "production.edit", "name": "Cập nhật tiến độ sản xuất", "module": "production"},
    {"code": "production.delete", "name": "Xóa lệnh sản xuất", "module": "production"},

    # ── Reports (Báo cáo) ─────────────────────────────────────────
    {"code": "reports.view", "name": "Xem báo cáo", "module": "reports"},
    {"code": "reports.view_all", "name": "Xem báo cáo toàn công ty (tất cả nhân viên)", "module": "reports"},
    {"code": "reports.export", "name": "Xuất báo cáo ra Excel/PDF", "module": "reports"},

    # ── Notifications (Thông báo) ─────────────────────────────────
    {"code": "notifications.view", "name": "Xem thông báo", "module": "notifications"},

    # ── Settings (Cài đặt công ty) ────────────────────────────────
    {"code": "settings.users", "name": "Quản lý tài khoản nhân viên", "module": "settings"},
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
                f"✅ Hoàn thành! Đã tạo mới {created_count} và cập nhật {updated_count} permissions.\n"
                f"   Tổng cộng: {len(PERMISSIONS)} permissions trong hệ thống."
            )
        )
