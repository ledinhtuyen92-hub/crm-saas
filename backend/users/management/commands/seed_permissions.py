from django.core.management.base import BaseCommand

from users.models import Permission, Role, CompanySettings


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
    {"code": "crm.auto_assign", "name": "Chia khách tự động (Round-robin)", "module": "crm"},
    {"code": "crm.import", "name": "Import khách hàng từ Excel", "module": "crm"},
    {"code": "crm.export", "name": "Xuất danh sách khách hàng", "module": "crm"},
    {"code": "crm.view_all", "name": "Xem tất cả khách hàng (không giới hạn bởi phân công)", "module": "crm"},
    {"code": "crm.manage_tags", "name": "Quản lý Tags khách hàng", "module": "crm"},
    {"code": "crm.auto_assign_self", "name": "Tự động phụ trách khách hàng do mình tạo", "module": "crm"},
    {"code": "crm.upload_interaction_files", "name": "Tải file lên Lịch sử chăm sóc (Hình ảnh, PDF...)", "module": "crm"},

    # ── Sales (Báo giá) ───────────────────────────────────────────
    {"code": "sales.view", "name": "Xem danh sách báo giá", "module": "sales"},
    {"code": "sales.create", "name": "Tạo báo giá mới", "module": "sales"},
    {"code": "sales.edit", "name": "Chỉnh sửa báo giá", "module": "sales"},
    {"code": "sales.delete", "name": "Xóa báo giá", "module": "sales"},
    {"code": "sales.approve", "name": "Duyệt báo giá", "module": "sales"},
    {"code": "sales.require_approval", "name": "Bắt buộc trình duyệt (không cho gửi trực tiếp)", "module": "sales"},
    {"code": "sales.export_pdf", "name": "Xuất PDF báo giá", "module": "sales"},
    {"code": "sales.view_all", "name": "Xem tất cả báo giá (không giới hạn bởi phòng ban/người tạo)", "module": "sales"},

    # ── Orders (Đơn hàng) ─────────────────────────────────────────
    {"code": "orders.view", "name": "Xem danh sách đơn hàng", "module": "orders"},
    {"code": "orders.create", "name": "Tạo đơn hàng mới", "module": "orders"},
    {"code": "orders.edit", "name": "Chỉnh sửa đơn hàng", "module": "orders"},
    {"code": "orders.delete", "name": "Xóa đơn hàng", "module": "orders"},
    {"code": "orders.approve", "name": "Duyệt / Từ chối đơn hàng", "module": "orders"},
    {"code": "orders.export_pdf", "name": "Xuất PDF đơn hàng", "module": "orders"},
    {"code": "orders.view_all", "name": "Xem tất cả đơn hàng (không giới hạn bởi người tạo)", "module": "orders"},

    # ── Products (Sản phẩm & Dịch vụ) ─────────────────────────────
    {"code": "products.view", "name": "Xem danh sách sản phẩm", "module": "products"},
    {"code": "products.create", "name": "Thêm sản phẩm mới", "module": "products"},
    {"code": "products.edit", "name": "Chỉnh sửa sản phẩm", "module": "products"},
    {"code": "products.delete", "name": "Xóa sản phẩm", "module": "products"},
    {"code": "products.manage_categories", "name": "Quản lý loại sản phẩm", "module": "products"},

    # ── Inventory (Kho vận) ───────────────────────────
    {"code": "inventory.view", "name": "Xem tồn kho & lịch sử giao dịch", "module": "inventory"},
    {"code": "inventory.import", "name": "Nhập hàng vào kho (tạo phiếu nhập)", "module": "inventory"},
    {"code": "inventory.adjust", "name": "Điều chỉnh tồn kho", "module": "inventory"},
    {"code": "inventory.export", "name": "Xem phiếu xuất kho", "module": "inventory"},
    {"code": "inventory.approve_export", "name": "Duyệt lệnh xuất kho", "module": "inventory"},
    {"code": "inventory.manual_export", "name": "Tạo phiếu xuất kho thủ công", "module": "inventory"},
    {"code": "inventory.manage_warehouse", "name": "Quản lý kho hàng", "module": "inventory"},

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

    # ── Approvals (Phê duyệt) ─────────────────────────────────────
    {"code": "approvals.view", "name": "Xem danh sách phê duyệt", "module": "approvals"},
    {"code": "approvals.approve", "name": "Duyệt/Từ chối yêu cầu", "module": "approvals"},
    {"code": "approvals.manage", "name": "Quản lý luồng phê duyệt", "module": "approvals"},

    # ── Finance (Tài chính & Kế toán) ─────────────────────────────
    {"code": "finance.view", "name": "Xem danh sách giao dịch tài chính", "module": "finance"},
    {"code": "finance.create_receipt", "name": "Tạo giao dịch thu/chi mới", "module": "finance"},
    {"code": "finance.edit", "name": "Chỉnh sửa giao dịch", "module": "finance"},
    {"code": "finance.delete", "name": "Xóa giao dịch", "module": "finance"},
    {"code": "finance.request_credit", "name": "Trình duyệt xuất kho nợ", "module": "finance"},
]


class Command(BaseCommand):
    help = "Seed danh sách permissions mặc định cho toàn bộ module CRM SaaS."

    def handle(self, *args, **options):
        # --- MIGRATION LOGIC CHO VIỆC TÁCH MODULE SẢN PHẨM ---
        self.stdout.write("Checking module products migration...")
        for cs in CompanySettings.objects.all():
            if 'inventory' in cs.active_modules and 'products' not in cs.active_modules:
                cs.active_modules.append('products')
                cs.save(update_fields=['active_modules'])
        
        try:
            inv_view_perm = Permission.objects.get(code="inventory.view")
            prod_view_perm, _ = Permission.objects.get_or_create(
                code="products.view",
                defaults={"name": "Xem danh sách sản phẩm", "module": "products"}
            )
            roles_with_inv = Role.objects.filter(permissions=inv_view_perm)
            for role in roles_with_inv:
                role.permissions.add(prod_view_perm)
            
            rename_map = {
                "inventory.create_product": ("products.create", "Thêm sản phẩm mới"),
                "inventory.edit_product": ("products.edit", "Chỉnh sửa sản phẩm"),
                "inventory.delete_product": ("products.delete", "Xóa sản phẩm"),
                "inventory.manage_categories": ("products.manage_categories", "Quản lý loại sản phẩm"),
            }
            for old_code, (new_code, new_name) in rename_map.items():
                try:
                    p = Permission.objects.get(code=old_code)
                    p.code = new_code
                    p.name = new_name
                    p.module = "products"
                    p.save()
                except Permission.DoesNotExist:
                    pass
        except Permission.DoesNotExist:
            pass
        # ------------------------------------------------------

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
