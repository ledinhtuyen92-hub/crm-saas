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
from users.models import Company, Permission, Role, SubscriptionPlan, User
from core.numbering import generate_quotation_number, generate_order_number


class Command(BaseCommand):
    help = "Khởi tạo dữ liệu mẫu (Demo Data) đầy đủ cho CRM SaaS Enterprise"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("⏳ Đang khởi tạo dữ liệu mẫu cho hệ thống..."))

        with transaction.atomic():
            # 0. Khởi tạo Gói dịch vụ SaaS (SubscriptionPlan)
            plans_data = [
                ("starter",      "Gói Starter",      5,     True),
                ("standard",     "Gói Standard",     15,    True),
                ("business",     "Gói Business",     30,    True),
                ("professional", "Gói Professional", 50,    True),
                ("enterprise",   "Gói Enterprise",   100,   True),
                ("vip",          "Gói VIP Unlimited", 99999, True),
            ]
            plans = {}
            for code, name, limit, is_default in plans_data:
                plan, _ = SubscriptionPlan.objects.get_or_create(
                    code=code,
                    defaults={"name": name, "user_limit": limit, "is_default": is_default},
                )
                plans[code] = plan
            self.stdout.write(f"📦 Đã tạo {len(plans)} gói dịch vụ SaaS")

            # 1. Khởi tạo hoặc lấy Company Demo (An Phát — công ty chính)
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

            # 1b. Tạo thêm các công ty demo khác để trang SaaS Admin có dữ liệu đầy đủ
            extra_companies_data = [
                {
                    "name": "Công ty TNHH Nội Thất Đại Thành",
                    "workspace_id": "DAITHANH",
                    "tax_code": "0102345678",
                    "address": "Quận 7, TP. Hồ Chí Minh",
                    "phone": "02873001234",
                    "user_limit": 5,
                    "is_active": True,
                },
                {
                    "name": "Tập đoàn Xây Dựng Hoà Bình",
                    "workspace_id": "HOABINH",
                    "tax_code": "0301234567",
                    "address": "Quận Bình Thạnh, TP. Hồ Chí Minh",
                    "phone": "02835678901",
                    "user_limit": 50,
                    "is_active": True,
                },
                {
                    "name": "CTCP Thép Việt Đức",
                    "workspace_id": "VIETDUC",
                    "tax_code": "0401234567",
                    "address": "KCN Phú Nghĩa, Chương Mỹ, Hà Nội",
                    "phone": "02433456789",
                    "user_limit": 30,
                    "is_active": True,
                },
                {
                    "name": "Công ty Cơ Điện Lạnh REE",
                    "workspace_id": "REECORP",
                    "tax_code": "0501234567",
                    "address": "Quận 4, TP. Hồ Chí Minh",
                    "phone": "02839456789",
                    "user_limit": 100,
                    "is_active": False,
                },
            ]
            for cdata in extra_companies_data:
                Company.objects.get_or_create(
                    tax_code=cdata["tax_code"],
                    defaults={k: v for k, v in cdata.items() if k != "tax_code"},
                )
            self.stdout.write(f"🏙️ Đã tạo {len(extra_companies_data)} công ty demo bổ sung")


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
                email="director@anphatgroup.vn",
                defaults={
                    "username": "director",
                    "full_name": "Lê Giám Đốc",
                    "company": company,
                    "role": role_director,
                    "is_company_admin": True,
                },
            )
            director_user.company = company
            director_user.role = role_director
            director_user.is_company_admin = True
            director_user.set_password("123456")
            director_user.save()

            self.stdout.write(f"👤 User Admin: admin (password: admin) | director (password: 123456)")

            # Tạo thêm user nhân viên Sale
            sale_data = [
                ("sale01", "Nguyễn Văn Sale 1", "sale01@anphatgroup.vn"),
                ("sale02", "Trần Thị Sale 2", "sale02@anphatgroup.vn"),
                ("sale03", "Phạm Văn Sale 3", "sale03@anphatgroup.vn"),
            ]
            sale_users = []
            for uname, fname, uemail in sale_data:
                u, _ = User.objects.get_or_create(
                    email=uemail,
                    defaults={
                        "username": uname,
                        "full_name": fname,
                        "company": company,
                        "role": role_staff,
                        "is_company_admin": False,
                    },
                )
                u.set_password("123456")
                u.save()
                sale_users.append(u)

            # Tạo thêm user nhân viên kỹ thuật
            tech_user, _ = User.objects.get_or_create(
                email="tech@anphatgroup.vn",
                defaults={
                    "username": "kythuat01",
                    "full_name": "Trần Văn Kỹ Thuật",
                    "company": company,
                    "role": role_staff,
                },
            )
            tech_user.set_password("123456")
            tech_user.save()

            # 4. Tạo Khách hàng
            # 4. Tạo danh sách Khách hàng phong phú
            import random
            customers_data = [
                ("Tập đoàn BĐS Vingroup", "0988888888", "vinhomes@vingroup.vn", "KĐT Vinhomes Riverside, Long Biên, HN", "facebook", "active"),
                ("Công ty Xây dựng Coteccons", "0911223344", "info@coteccons.vn", "Nam Từ Liêm, Hà Nội", "referral", "active"),
                ("Biệt thự Sun Grand City", "0901234567", "sales@sungrand.vn", "Ciputra, Tây Hồ, Hà Nội", "zalo", "potential"),
                ("Chung cư The Habitat", "0912345678", "pm@habitat.vn", "Bình Dương", "website", "active"),
                ("Dự án Sapphire Tower", "0923456789", "info@sapphire.vn", "Đống Đa, Hà Nội", "facebook", "new"),
                ("CTCP Nội thất An Gia", "0934567890", "order@angiafurni.vn", "Hoàng Mai, Hà Nội", "referral", "potential"),
                ("Khu nghỉ dưỡng Flamingo", "0945678901", "purchase@flamingo.vn", "Đại Lải, Vĩnh Phúc", "walk_in", "active"),
                ("Nhà hàng Crystal Jade", "0956789012", "admin@crystaljade.vn", "Hoàn Kiếm, Hà Nội", "zalo", "new"),
                ("Công ty CP Đông Á Land", "0967890123", "info@dongaland.vn", "Long Biên, Hà Nội", "facebook", "potential"),
                ("Chị Lan (cá nhân)", "0978901234", "lan.nguyen@gmail.com", "Cầu Giấy, Hà Nội", "referral", "active"),
            ]
            all_customers = []
            for i, (cname, cphone, cemail, caddr, csource, cstatus) in enumerate(customers_data):
                assigned = sale_users[i % len(sale_users)] if sale_users else tech_user
                cust, _ = Customer.objects.get_or_create(
                    company=company,
                    phone=cphone,
                    defaults={
                        "name": cname,
                        "email": cemail,
                        "address": caddr,
                        "source": csource,
                        "status": cstatus,
                        "assigned_to": assigned,
                        "created_by": assigned,
                    },
                )
                all_customers.append(cust)
            cust_vingroup = all_customers[0]
            cust_coteccons = all_customers[1]
            self.stdout.write(f"🤝 Đã tạo {len(all_customers)} khách hàng mẫu")

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
