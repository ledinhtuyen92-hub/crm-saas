from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction

from crm.models import Customer
from inventory.models import (
    InventoryTransaction,
    Product,
    ProductCategory,
    StockLevel,
    Warehouse,
)
from orders.models import Order, OrderItem
from production.models import ProductionOrder, ProductionStep
from sales.models import Quotation, QuotationItem
from users.models import Company, Permission, Role, User
from core.numbering import generate_quotation_number, generate_order_number


class Command(BaseCommand):
    help = "Khởi tạo dữ liệu mẫu (Demo Data) đầy đủ cho CRM SaaS Enterprise"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("⏳ Đang khởi tạo dữ liệu mẫu cho hệ thống..."))

        with transaction.atomic():
            # 1. Khởi tạo hoặc lấy Company Demo
            company, _ = Company.objects.get_or_create(
                tax_code="0101246810",
                defaults={
                    "name": "Công ty Nhôm Kính Cao Cấp An Phát",
                    "workspace_id": "ANPHAT",
                    "address": "KCN Bắc Thăng Long, Đông Anh, Hà Nội",
                    "phone": "02438889999",
                    "user_limit": 15,
                },
            )
            self.stdout.write(f"🏢 Công ty: {company.name}")

            # 2. Khởi tạo Vai trò Giám đốc & Gán toàn bộ quyền
            role_director, _ = Role.objects.get_or_create(
                company=company,
                name="Giám đốc Điều hành",
                defaults={"description": "Toàn quyền quản trị hệ thống"},
            )
            all_perms = Permission.objects.all()
            role_director.permissions.set(all_perms)

            role_staff, _ = Role.objects.get_or_create(
                company=company,
                name="Nhân viên Kinh doanh & Sản xuất",
                defaults={"description": "Quản lý khách hàng, báo giá, đơn hàng và xưởng"},
            )
            role_staff.permissions.set(all_perms)

            # 3. Cập nhật user admin hiện tại hoặc tạo user demo (SaaS Superadmin hệ thống, không thuộc công ty cụ thể)
            admin_user, _ = User.objects.get_or_create(
                username="admin",
                defaults={
                    "email": "admin@saas-platform.vn",
                    "full_name": "SaaS System Administrator",
                    "company": None,
                    "role": None,
                    "is_company_admin": False,
                    "is_superuser": True,
                    "is_staff": True,
                },
            )
            admin_user.company = None
            admin_user.role = None
            admin_user.is_company_admin = False
            admin_user.is_superuser = True
            admin_user.is_staff = True
            admin_user.set_password("admin")
            admin_user.save()

            # Tạo thêm user Giám đốc với mật khẩu 123456
            director_user, _ = User.objects.get_or_create(
                username="director",
                defaults={
                    "email": "director@anphatgroup.vn",
                    "full_name": "Lê Giám Đốc",
                    "company": company,
                    "role": role_director,
                    "is_company_admin": True,
                },
            )
            director_user.set_password("123456")
            director_user.save()

            self.stdout.write(f"👤 User Admin: admin (password: admin) | director (password: 123456)")

            # Tạo thêm user nhân viên kỹ thuật
            tech_user, _ = User.objects.get_or_create(
                username="kythuat01",
                defaults={
                    "email": "tech@anphatgroup.vn",
                    "full_name": "Trần Văn Kỹ Thuật",
                    "company": company,
                    "role": role_staff,
                },
            )
            tech_user.set_password("123456")
            tech_user.save()

            # 4. Tạo Khách hàng
            cust_vingroup, _ = Customer.objects.get_or_create(
                company=company,
                phone="0988888888",
                defaults={
                    "name": "Tập đoàn Bất động sản Vingroup",
                    "email": "vinhomes@vingroup.vn",
                    "address": "KĐT Vinhomes Riverside, Long Biên, Hà Nội",
                    "status": Customer.STATUS_ACTIVE,
                    "assigned_to": admin_user,
                    "notes": "Khách hàng VIP - Dự án biệt thự cao cấp",
                },
            )
            cust_coteccons, _ = Customer.objects.get_or_create(
                company=company,
                phone="0911223344",
                defaults={
                    "name": "Công ty Cổ phần Xây dựng Coteccons",
                    "email": "info@coteccons.vn",
                    "address": "Tòa nhà Coteccons, Nam Từ Liêm, Hà Nội",
                    "status": Customer.STATUS_ACTIVE,
                    "assigned_to": tech_user,
                },
            )
            self.stdout.write(f"🤝 Khách hàng: {cust_vingroup.name}, {cust_coteccons.name}")

            # 5. Tạo Kho hàng & Danh mục Sản phẩm
            warehouse, _ = Warehouse.objects.get_or_create(
                company=company,
                name="Kho Tổng Hà Nội",
                defaults={"location": "KCN Quang Minh, Mê Linh, Hà Nội", "is_active": True},
            )

            cat_xingfa, _ = ProductCategory.objects.get_or_create(
                company=company,
                name="Cửa Nhôm Xingfa Hệ 55",
                defaults={"description": "Dòng cửa nhôm cao cấp cách âm cách nhiệt"},
            )
            cat_pmi, _ = ProductCategory.objects.get_or_create(
                company=company,
                name="Cửa Nhôm PMI nhập khẩu",
                defaults={"description": "Dòng nhôm cầu cách nhiệt tiêu chuẩn châu Âu"},
            )

            prod1, _ = Product.objects.get_or_create(
                company=company,
                sku="XINGFA-4C-01",
                defaults={
                    "category": cat_xingfa,
                    "name": "Cửa đi 4 cánh mở quay nhôm Xingfa dày 2.0mm",
                    "unit": Product.UNIT_BO,
                    "cost_price": Decimal("4500000"),
                    "price": Decimal("6500000"),
                    "description": "Kính dán an toàn 8.38mm, phụ kiện Kinlong đồng bộ",
                },
            )
            prod2, _ = Product.objects.get_or_create(
                company=company,
                sku="PMI-2C-02",
                defaults={
                    "category": cat_pmi,
                    "name": "Cửa sổ trượt 2 cánh nhôm PMI nhập khẩu",
                    "unit": Product.UNIT_BO,
                    "cost_price": Decimal("2800000"),
                    "price": Decimal("4200000"),
                    "description": "Kính cường lực 10mm, ray trượt êm ái",
                },
            )

            # Tạo tồn kho ban đầu
            StockLevel.objects.get_or_create(
                warehouse=warehouse,
                product=prod1,
                defaults={"quantity": Decimal("100.00"), "min_quantity": Decimal("10.00")},
            )
            StockLevel.objects.get_or_create(
                warehouse=warehouse,
                product=prod2,
                defaults={"quantity": Decimal("80.00"), "min_quantity": Decimal("10.00")},
            )
            self.stdout.write(f"📦 Sản phẩm & Kho hàng đã sẵn sàng")

            # 6. Tạo Báo giá mẫu
            if not Quotation.objects.filter(company=company).exists():
                q_num = generate_quotation_number(company)
                quotation = Quotation.objects.create(
                    company=company,
                    quotation_number=q_num,
                    customer=cust_vingroup,
                    created_by=admin_user,
                    status=Quotation.STATUS_ACCEPTED,
                    discount_total=Decimal("1000000"),
                    total_amount=Decimal("64000000"),
                    notes="Báo giá đợt 1 - Biệt thự Hoa Lan",
                )
                QuotationItem.objects.create(
                    quotation=quotation,
                    product=prod1,
                    product_name=prod1.name,
                    unit_price=prod1.price,
                    width=Decimal("2.40"),
                    height=Decimal("2.80"),
                    quantity=Decimal("10.00"),
                    discount_percent=Decimal("0.00"),
                )
                self.stdout.write(f"📋 Đã tạo báo giá mẫu: {quotation.quotation_number}")

                # Chuyển thành Đơn hàng
                o_num = generate_order_number(company)
                order = Order.objects.create(
                    company=company,
                    order_number=o_num,
                    customer=cust_vingroup,
                    quotation=quotation,
                    created_by=admin_user,
                    status=Order.STATUS_PENDING,
                    total_amount=quotation.total_amount,
                    notes=quotation.notes,
                )
                OrderItem.objects.create(
                    order=order,
                    product=prod1,
                    product_name=prod1.name,
                    unit_price=prod1.price,
                    width=Decimal("2.40"),
                    height=Decimal("2.80"),
                    quantity=Decimal("10.00"),
                    discount_percent=Decimal("0.00"),
                )
                self.stdout.write(f"🛒 Đã tạo đơn hàng chờ duyệt: {order.order_number}")

                # Duyệt đơn hàng -> Kích hoạt tự động xuất kho & tạo Lệnh sản xuất
                order.approve(approved_by_user=admin_user)
                self.stdout.write(f"✅ Đã duyệt đơn hàng {order.order_number} -> Tự động tạo Phiếu Xuất Kho & Lệnh Sản Xuất!")

                # Thêm công đoạn sản xuất mẫu
                po = ProductionOrder.objects.filter(order=order).first()
                if po:
                    ProductionStep.objects.create(
                        production_order=po,
                        step_name="1. Đo đạc & Cắt nhôm Xingfa",
                        sequence=1,
                        assigned_to=tech_user,
                        status=ProductionStep.STATUS_DONE,
                        notes="Đã cắt chuẩn kích thước 2.4m x 2.8m",
                    )
                    ProductionStep.objects.create(
                        production_order=po,
                        step_name="2. Lắp ráp khung & Ghép kính",
                        sequence=2,
                        assigned_to=tech_user,
                        status=ProductionStep.STATUS_IN_PROGRESS,
                        notes="Đang tiến hành ép góc và bôi keo",
                    )
                    ProductionStep.objects.create(
                        production_order=po,
                        step_name="3. Kiểm tra chất lượng & Bọc lót xuất xưởng",
                        sequence=3,
                        assigned_to=tech_user,
                        status=ProductionStep.STATUS_PENDING,
                    )
                    self.stdout.write(f"⚙️ Đã thêm 3 công đoạn thi công vào lệnh sản xuất ID #{po.id} (Đơn hàng {po.order.order_number})")

        self.stdout.write(self.style.SUCCESS("🎉 HOÀN TẤT KHỞI TẠO DỮ LIỆU MẪU SẴN SÀNG ĐỂ TRẢI NGHIỆM!"))
