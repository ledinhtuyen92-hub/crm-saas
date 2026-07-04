from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

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
from users.models import Company, Role, User


class EndToEndWorkflowIntegrationTests(APITestCase):
    """
    Kiểm thử tích hợp luồng nghiệp vụ hoàn chỉnh (E2E Integration Test):
    Quotation -> Order (create-order) -> Order Approve -> Auto Inventory Export + Auto Production Order -> Production Step progress.
    """

    def setUp(self):
        # 1. Tạo Company và User Admin
        self.company = Company.objects.create(
            name="Nhóm Doanh nghiệp Nhôm Kính Enterprise",
            tax_code="0101234567",
            address="Hà Nội, Việt Nam",
        )
        self.role = Role.objects.create(
            company=self.company,
            name="Giám đốc Kinh doanh",
        )
        self.user = User.objects.create_user(
            username="director_e2e",
            email="director@enterprise.vn",
            password="StrongPassword123!",
            full_name="Nguyễn Văn Giám Đốc",
            company=self.company,
            role=self.role,
            is_company_admin=True,
        )
        self.client.force_authenticate(self.user)

        # 2. Tạo Khách hàng
        self.customer = Customer.objects.create(
            company=self.company,
            name="Tập đoàn Bất động sản Vingroup",
            phone="0988888888",
            email="contact@vingroup.vn",
            status=Customer.STATUS_ACTIVE,
        )

        # 3. Tạo Danh mục, Sản phẩm, và Kho hàng
        self.category = ProductCategory.objects.create(
            company=self.company,
            name="Cửa Nhôm Xingfa Hệ 55",
            description="Chuyên dùng cho biệt thự, chung cư cao cấp",
        )
        self.product = Product.objects.create(
            company=self.company,
            category=self.category,
            sku="XINGFA-4C-001",
            name="Cửa đi 4 cánh mở quay nhôm Xingfa",
            unit="bộ",
            cost_price=Decimal("4500000"),
            price=Decimal("6500000"),
        )
        self.warehouse = Warehouse.objects.create(
            company=self.company,
            name="Kho Tổng Hà Nội",
            location="KCN Quang Minh, Mê Linh, Hà Nội",
        )

        # 4. Nhập kho ban đầu cho sản phẩm (Tồn ban đầu = 50 bộ)
        self.initial_stock_quantity = Decimal("50.00")
        self.stock_level = StockLevel.objects.create(
            warehouse=self.warehouse,
            product=self.product,
            quantity=self.initial_stock_quantity,
            min_quantity=Decimal("5.00"),
        )

    def test_complete_quotation_to_order_to_production_workflow(self):
        # ── BƯỚC 1: TẠO BÁO GIÁ (QUOTATION) ──────────────────────────────────
        quotation_data = {
            "customer": self.customer.id,
            "title": "Báo giá lắp đặt Cửa nhôm Biệt thự Vinhomes",
            "status": Quotation.STATUS_ACCEPTED,  # Khách hàng đã đồng ý
            "tax_rate": Decimal("10.00"),
            "discount": Decimal("0.00"),
        }

        res_quotation = self.client.post("/api/sales/quotations/", quotation_data, format="json")
        self.assertEqual(res_quotation.status_code, status.HTTP_201_CREATED, res_quotation.data)
        quotation_id = res_quotation.data["id"]

        item_data = {
            "quotation": quotation_id,
            "product": self.product.id,
            "product_name": self.product.name,
            "description": "Cửa đi 4 cánh kính an toàn 8.38mm",
            "width": Decimal("2.40"),
            "height": Decimal("2.80"),
            "quantity": Decimal("10.00"),
            "unit_price": Decimal("6500000.00"),
            "discount_percent": Decimal("0.00"),
        }
        res_item = self.client.post("/api/sales/quotation-items/", item_data, format="json")
        self.assertEqual(res_item.status_code, status.HTTP_201_CREATED, res_item.data)

        quotation = Quotation.objects.get(id=quotation_id)
        self.assertEqual(quotation.items.count(), 1)
        self.assertEqual(quotation.items.first().width, Decimal("2.40"))

        # ── BƯỚC 2: CHUYỂN ĐỔI BÁO GIÁ THÀNH ĐƠN HÀNG (ONE-CLICK ORDER) ────────
        res_create_order = self.client.post(
            f"/api/sales/quotations/{quotation_id}/create-order/",
            format="json",
        )
        self.assertEqual(res_create_order.status_code, status.HTTP_201_CREATED, res_create_order.data)
        order_id = res_create_order.data["id"]
        order = Order.objects.get(id=order_id)
        
        # Kiểm tra đơn hàng tạo thành công với đúng trạng thái và thông tin
        self.assertEqual(order.status, Order.STATUS_PENDING)
        self.assertEqual(order.customer, self.customer)
        self.assertEqual(order.items.count(), 1)
        order_item = order.items.first()
        self.assertEqual(order_item.product, self.product)
        self.assertEqual(order_item.quantity, Decimal("10.00"))
        self.assertEqual(order_item.width, Decimal("2.40"))
        self.assertEqual(order_item.height, Decimal("2.80"))

        # ── BƯỚC 3: QUẢN LÝ DUYỆT ĐƠN HÀNG (APPROVE ORDER) ─────────────────────
        res_approve = self.client.post(
            f"/api/orders/orders/{order_id}/approve/",
            format="json",
        )
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK, res_approve.data)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.STATUS_APPROVED)

        # ── BƯỚC 4: KIỂM TRA TỰ ĐỘNG XUẤT KHO VÀ TRỪ TỒN KHO ───────────────────
        # Kiểm tra phiếu xuất kho tự động đã được tạo ra
        export_txs = InventoryTransaction.objects.filter(
            reference_order=order,
            type=InventoryTransaction.TYPE_EXPORT,
        )
        self.assertTrue(export_txs.exists(), "Phiếu xuất kho tự động phải được sinh khi duyệt đơn!")
        export_tx = export_txs.first()
        self.assertTrue(export_tx.transaction_code.startswith("EXP-"))

        # Kiểm tra tồn kho (StockLevel) đã được giảm chính xác 10 bộ
        self.stock_level.refresh_from_db()
        expected_remaining_stock = self.initial_stock_quantity - Decimal("10.00")
        self.assertEqual(
            self.stock_level.quantity,
            expected_remaining_stock,
            f"Tồn kho phải giảm từ {self.initial_stock_quantity} xuống {expected_remaining_stock}",
        )

        # ── BƯỚC 5: KIỂM TRA TỰ ĐỘNG TẠO LỆNH SẢN XUẤT (PRODUCTION ORDER) ─────
        production_orders = ProductionOrder.objects.filter(order=order)
        self.assertTrue(production_orders.exists(), "Lệnh sản xuất phải được tự động sinh khi duyệt đơn!")
        po = production_orders.first()
        self.assertEqual(po.status, ProductionOrder.STATUS_PENDING)
        self.assertEqual(po.company, self.company)

        # ── BƯỚC 6: THÊM CÔNG ĐOẠN SẢN XUẤT VÀ CẬP NHẬT TIẾN ĐỘ ────────────────
        step_data = {
            "production_order": po.id,
            "step_name": "Cắt nhôm và chuẩn bị kính an toàn",
            "sequence": 1,
            "assigned_to": self.user.id,
            "status": ProductionStep.STATUS_IN_PROGRESS,
            "notes": "Cắt đúng kích thước 2.4m x 2.8m, kiểm tra kỹ lưỡng",
        }
        res_step = self.client.post("/api/production/production-steps/", step_data, format="json")
        self.assertEqual(res_step.status_code, status.HTTP_201_CREATED, res_step.data)
        step_id = res_step.data["id"]
        step = ProductionStep.objects.get(id=step_id)
        
        self.assertEqual(step.step_name, "Cắt nhôm và chuẩn bị kính an toàn")
        self.assertEqual(step.status, ProductionStep.STATUS_IN_PROGRESS)
        self.assertIsNotNone(step.assigned_to)

        # Cập nhật trạng thái bước hoàn thành
        res_step_patch = self.client.patch(
            f"/api/production/production-steps/{step_id}/",
            {"status": ProductionStep.STATUS_DONE},
            format="json",
        )
        self.assertEqual(res_step_patch.status_code, status.HTTP_200_OK, res_step_patch.data)
        step.refresh_from_db()
        self.assertEqual(step.status, ProductionStep.STATUS_DONE)

        print("\n✅ KIỂM THỬ TÍCH HỢP TOÀN BỘ LUỒNG NGHIỆP VỤ E2E: THÀNH CÔNG RỰC RỠ! 🎉")
