# Bước 1: Thiết Kế Database Schema — CRM SaaS

## Tổng Quan Kiến Trúc

Sau khi quét toàn bộ codebase, đây là hiện trạng và kế hoạch nâng cấp:

### Hiện Trạng Code
| App | Models Hiện Có | Vấn Đề |
|-----|----------------|---------|
| `users` | `Company`, `Permission`, `Role`, `User` | ✅ Tốt — đã có RBAC + Multi-tenant cơ bản |
| `crm` | `Customer`, `CustomerContact`, `CustomerInteraction` | ❌ Thiếu `company_id`, thiếu `Tag`, thiếu `LeadStatus` pipeline |
| `sales` | `Lead`, `Quotation`, `QuotationItem` | ❌ Thiếu `company_id`, `Lead` trùng chức năng với `Customer` |
| `orders` | `Order`, `OrderItem` | ❌ Thiếu `company_id`, `order_number` không có prefix logic |
| `inventory` | `ProductCategory`, `Product`, `Warehouse`, `Inventory`, `InventoryTransaction` | ❌ Thiếu `company_id` toàn bộ, `ProductCategory.name` unique toàn hệ thống (sai) |
| `production` | `ProductionOrder`, `ProductionStep` | ❌ Thiếu `company_id` |

> [!CAUTION]
> **6/7 app đang thiếu `company_id`** — đây là lỗ hổng bảo mật nghiêm trọng nhất cần sửa ngay. Dữ liệu các công ty đang không được cô lập.

---

## Chiến Lược Migration

> [!IMPORTANT]
> Chúng ta sẽ **viết lại toàn bộ models** theo chuẩn enterprise, sau đó chạy `makemigrations` + `migrate` fresh. Vì dự án đang trong giai đoạn phát triển (chưa có production data thực), cách này an toàn và sạch nhất.

---

## Proposed Changes — Database Schema

---

### 📦 App: `users` — Hệ Thống Người Dùng & Phân Quyền

> **Giữ nguyên** cấu trúc tốt hiện có, chỉ bổ sung thêm trường `user_limit` cho quota.

#### [MODIFY] [models.py](file:///d:/LẬP TRÌNH/crm_saas/backend/users/models.py)

**Thêm vào `Company`:**
- `user_limit` — `PositiveIntegerField(null=True, blank=True)`: Giới hạn số nhân viên (None = không giới hạn)
- `phone` — `CharField(max_length=20, blank=True)`: SĐT công ty
- `logo` — `ImageField(upload_to='company_logos/', blank=True)`: Logo công ty

**Thêm vào `User`:**
- `avatar` — `ImageField(upload_to='avatars/', blank=True)`: Ảnh đại diện

---

### 📦 App: `crm` — Quản Lý Khách Hàng & Leads

#### [MODIFY] [models.py](file:///d:/LẬP TRÌNH/crm_saas/backend/crm/models.py)

```
CustomerTag (company_id ✅)
├── id
├── company → FK(Company, CASCADE)
├── name → CharField(100)
└── color → CharField(20)   # Hex color, VD: "#FF5733"

Customer (company_id ✅)
├── id
├── company → FK(Company, CASCADE)  # ← THÊM MỚI (thiếu hiện tại!)
├── name → CharField(255)
├── phone → CharField(20)           # unique_together với company
├── email → EmailField(blank=True)
├── address → TextField(blank=True)
├── city → CharField(100, blank=True)
├── source → CharField(50, choices)  # facebook, zalo, referral, walk_in, website, other
├── status → CharField(20, choices)  # new, potential, active, lost, inactive
├── tags → M2M(CustomerTag)
├── assigned_to → FK(User, SET_NULL, null=True)  # Sale phụ trách
├── created_by → FK(User, SET_NULL, null=True)   # Người tạo
├── notes → TextField(blank=True)
├── created_at → DateTimeField(auto_now_add=True)
└── updated_at → DateTimeField(auto_now=True)

CustomerContact (không cần company_id — truy cập qua customer.company)
├── id
├── customer → FK(Customer, CASCADE)
├── name → CharField(255)
├── phone → CharField(20, blank=True)
├── email → EmailField(blank=True)
└── position → CharField(100, blank=True)

CustomerInteraction (lịch sử chăm sóc — timeline)
├── id
├── customer → FK(Customer, CASCADE)
├── created_by → FK(User, PROTECT)   # đổi tên từ "user" cho rõ ràng hơn
├── type → CharField(20, choices)    # call, meeting, email, zalo, quotation, care
├── content → TextField()
├── result → CharField(20, choices)  # interested, not_interested, need_follow_up, closed
├── next_follow_up → DateTimeField(null=True, blank=True)
└── created_at → DateTimeField(auto_now_add=True)
```

**Constraint quan trọng:**
- `UniqueConstraint(fields=['company', 'phone'], name='unique_customer_phone_per_company')`

---

### 📦 App: `sales` — Pipeline & Báo Giá

> Tái cấu trúc: Xóa model `Lead` riêng biệt (trùng với Customer), gắn pipeline status vào `Customer`. Quotation là báo giá chính thức.

#### [MODIFY] [models.py](file:///d:/LẬP TRÌNH/crm_saas/backend/sales/models.py)

```
Quotation (company_id ✅)
├── id
├── company → FK(Company, CASCADE)       # ← THÊM MỚI
├── quotation_number → CharField(50)     # unique_together với company
├── customer → FK(Customer, PROTECT)
├── created_by → FK(User, SET_NULL, null=True)
├── status → CharField(20, choices)     # draft, sent, accepted, rejected
├── installation_date → DateField(null=True, blank=True)  # Ngày lắp đặt
├── notes → TextField(blank=True)
├── discount_total → DecimalField(15,2, default=0)
├── total_amount → DecimalField(15,2)
├── created_at → DateTimeField(auto_now_add=True)
└── updated_at → DateTimeField(auto_now=True)

QuotationItem (truy cập qua quotation.company)
├── id
├── quotation → FK(Quotation, CASCADE)
├── product → FK(Product, PROTECT)      # đổi từ product_id int → FK thực
├── product_name → CharField(255)       # snapshot tên lúc tạo báo giá
├── unit_price → DecimalField(15,2)     # snapshot giá lúc tạo
├── quantity → PositiveIntegerField()
├── discount_percent → DecimalField(5,2, default=0)  # % chiết khấu
├── line_total → DecimalField(15,2)     # tính tự động = qty * price * (1 - discount/100)
└── note → CharField(255, blank=True)
```

---

### 📦 App: `orders` — Đơn Hàng

#### [MODIFY] [models.py](file:///d:/LẬP TRÌNH/crm_saas/backend/orders/models.py)

```
Order (company_id ✅)
├── id
├── company → FK(Company, CASCADE)       # ← THÊM MỚI
├── order_number → CharField(50)         # unique_together với company; format: [PREFIX]_[YYYYMMDD]_[SEQ]
├── customer → FK(Customer, PROTECT)
├── quotation → FK(Quotation, SET_NULL, null=True, blank=True)
├── created_by → FK(User, SET_NULL, null=True)
├── approved_by → FK(User, SET_NULL, null=True, related_name='approved_orders')
├── status → CharField(20, choices)     # pending, approved, rejected, cancelled, completed
├── installation_date → DateField(null=True, blank=True)
├── notes → TextField(blank=True)
├── discount_total → DecimalField(15,2, default=0)
├── total_amount → DecimalField(15,2)
├── approved_at → DateTimeField(null=True, blank=True)
├── created_at → DateTimeField(auto_now_add=True)
└── updated_at → DateTimeField(auto_now=True)

OrderItem (truy cập qua order.company)
├── id
├── order → FK(Order, CASCADE)
├── product → FK(Product, PROTECT)       # FK thực thay vì int
├── product_name → CharField(255)        # snapshot
├── unit_price → DecimalField(15,2)      # snapshot giá tại thời điểm tạo đơn
├── quantity → PositiveIntegerField()
├── discount_percent → DecimalField(5,2, default=0)
└── line_total → DecimalField(15,2)      # qty * price * (1 - discount/100)
```

**Workflow bắt buộc:**
- Đơn mới → `status='pending'`
- Approved → trigger tự động tạo `InventoryTransaction(type='export')`
- Backend chặn cứng: nếu `status != 'approved'` thì không cho phép tạo export transaction

---

### 📦 App: `inventory` — Sản Phẩm & Kho Vận

#### [MODIFY] [models.py](file:///d:/LẬP TRÌNH/crm_saas/backend/inventory/models.py)

```
ProductCategory (company_id ✅)
├── id
├── company → FK(Company, CASCADE)       # ← THÊM MỚI (hiện đang unique toàn hệ thống - SAI!)
├── name → CharField(150)
└── description → CharField(255, blank=True)
# Constraint: UniqueConstraint(fields=['company', 'name'])

Product (company_id ✅)
├── id
├── company → FK(Company, CASCADE)       # ← THÊM MỚI
├── category → FK(ProductCategory, PROTECT)
├── sku → CharField(100)                 # unique_together với company
├── name → CharField(255)
├── description → TextField(blank=True)
├── unit → CharField(20, default='cái') # đơn vị: cái, m², m, bộ, kg...
├── price → DecimalField(15,2)           # Giá bán
├── cost_price → DecimalField(15,2, default=0)  # Giá nhập
├── image → ImageField(upload_to='products/', blank=True)
├── is_active → BooleanField(default=True)
├── created_at → DateTimeField(auto_now_add=True)
└── updated_at → DateTimeField(auto_now=True)

Warehouse (company_id ✅)
├── id
├── company → FK(Company, CASCADE)       # ← THÊM MỚI
├── name → CharField(150)
├── location → CharField(255, blank=True)
└── is_active → BooleanField(default=True)
# Constraint: UniqueConstraint(fields=['company', 'name'])

StockLevel (Tồn kho — company_id truy cập qua product/warehouse)
├── id
├── product → FK(Product, CASCADE)
├── warehouse → FK(Warehouse, CASCADE)
├── quantity → IntegerField(default=0)   # Tồn kho thực tế
└── min_quantity → IntegerField(default=0)  # Ngưỡng cảnh báo tồn kho thấp
# Constraint: UniqueConstraint(fields=['product', 'warehouse'])

InventoryTransaction (Phiếu Nhập/Xuất/Điều Chỉnh Kho — company_id ✅)
├── id
├── company → FK(Company, CASCADE)       # ← THÊM MỚI (cần index trực tiếp cho dashboard)
├── transaction_code → CharField(50)    # unique_together với company; VD: IMP-20240101-001
├── type → CharField(20, choices)       # import (nhập), export (xuất), adjust (điều chỉnh)
├── product → FK(Product, PROTECT)
├── warehouse → FK(Warehouse, PROTECT)
├── quantity → IntegerField()            # Số lượng (dương=nhập, âm=xuất điều chỉnh)
├── unit_cost → DecimalField(15,2, default=0)  # Giá nhập (chỉ dùng cho type=import)
├── reference_order → FK(Order, SET_NULL, null=True, blank=True)  # Link tới đơn hàng nếu type=export
├── note → TextField(blank=True)
├── created_by → FK(User, SET_NULL, null=True)
└── created_at → DateTimeField(auto_now_add=True)
```

---

### 📦 App: `notifications` — Thông Báo Real-time [MỚI]

> App mới cần được tạo để hỗ trợ WebSocket Notifications.

#### [NEW] `backend/notifications/` — App mới

```
Notification (company_id ✅)
├── id
├── company → FK(Company, CASCADE)
├── recipient → FK(User, CASCADE)        # Người nhận
├── sender → FK(User, SET_NULL, null=True)  # Người gửi (null = system)
├── type → CharField(30, choices)       # order_new, order_approved, crm_assigned, system_update
├── title → CharField(255)
├── message → TextField()
├── link → CharField(255, blank=True)   # URL điều hướng khi click VD: /orders/123
├── is_read → BooleanField(default=False)
└── created_at → DateTimeField(auto_now_add=True)
```

---

### 📦 App: `production` — Sản Xuất / Vận Hành

#### [MODIFY] [models.py](file:///d:/LẬP TRÌNH/crm_saas/backend/production/models.py)

```
ProductionOrder (company_id ✅)
├── id
├── company → FK(Company, CASCADE)   # ← THÊM MỚI
├── order → FK(Order, PROTECT)
├── status → CharField(20, choices)  # pending, in_progress, completed, cancelled
├── start_date → DateField(null=True, blank=True)
├── end_date → DateField(null=True, blank=True)
├── notes → TextField(blank=True)
└── created_at → DateTimeField(auto_now_add=True)

ProductionStep (truy cập company qua production_order)
├── id
├── production_order → FK(ProductionOrder, CASCADE)
├── step_name → CharField(150)
├── assigned_to → FK(User, SET_NULL, null=True)
├── status → CharField(20, choices)  # pending, in_progress, done
├── started_at → DateTimeField(null=True, blank=True)
└── completed_at → DateTimeField(null=True, blank=True)
```

---

### 📦 App: `users` — Bổ Sung CompanySettings [MỚI Model]

```
CompanySettings (cấu hình công ty — không cần company_id riêng, là 1-1 với Company)
├── id
├── company → OneToOneField(Company, CASCADE, related_name='settings')
├── order_prefix → CharField(10, default='DH')  # Tiền tố mã đơn hàng
├── default_warehouse → FK(Warehouse, SET_NULL, null=True)  # Kho mặc định
├── lead_routing → CharField(20, choices, default='manual')  # manual, round_robin
└── timezone → CharField(50, default='Asia/Ho_Chi_Minh')
```

---

## Sơ Đồ Quan Hệ (ERD Overview)

```
Company ──────────────────────────────────────────────────────────┐
  │ (one-to-many với tất cả entity bên dưới)                      │
  ├──→ User (role → Role → permissions)                           │
  ├──→ Role → Permission (M2M)                                    │
  ├──→ CustomerTag                                                 │
  ├──→ Customer ──→ CustomerContact                               │
  │         └──→ CustomerInteraction                              │
  ├──→ ProductCategory                                            │
  ├──→ Product                                                    │
  ├──→ Warehouse                                                  │
  │         └──→ StockLevel (Product × Warehouse)                 │
  ├──→ InventoryTransaction (Product, Warehouse, Order?)          │
  ├──→ Quotation → QuotationItem → Product                       │
  ├──→ Order ──→ OrderItem → Product                             │
  │         └──→ InventoryTransaction (auto khi Approved)         │
  ├──→ ProductionOrder → ProductionStep                          │
  ├──→ Notification                                               │
  └──→ CompanySettings                                            │
```

---

## Bảng Permission Codes (Seed Data)

Khi chạy `python manage.py seed_permissions`, hệ thống sẽ tạo các permission codes:

| Module | Code | Tên hiển thị |
|--------|------|--------------|
| crm | crm.view | Xem danh sách khách hàng |
| crm | crm.add | Thêm khách hàng |
| crm | crm.edit | Sửa thông tin khách hàng |
| crm | crm.delete | Xóa khách hàng |
| crm | crm.assign | Phân công khách hàng |
| crm | crm.import | Import khách hàng từ Excel |
| products | products.view | Xem sản phẩm |
| products | products.add | Thêm sản phẩm |
| products | products.edit | Sửa sản phẩm |
| products | products.delete | Xóa sản phẩm |
| orders | orders.view | Xem đơn hàng |
| orders | orders.add | Tạo đơn hàng |
| orders | orders.edit | Sửa đơn hàng |
| orders | orders.delete | Xóa đơn hàng |
| orders | orders.approve | Duyệt đơn hàng |
| orders | orders.export_pdf | Xuất PDF đơn hàng |
| inventory | inventory.view | Xem tồn kho |
| inventory | inventory.import | Nhập hàng vào kho |
| inventory | inventory.adjust | Điều chỉnh tồn kho |
| reports | reports.view | Xem báo cáo |
| reports | reports.export | Xuất báo cáo |
| notifications | notifications.view | Xem thông báo |

---

## Open Questions

> [!IMPORTANT]
> **Q1: Module `sales.Lead`** — Hiện tại có model `Lead` riêng trong app `sales`. Xác nhận **xóa model `Lead`** và tích hợp vào `Customer.status` (new → potential → active → lost). 

> [!IMPORTANT]
> **Q2: `QuotationItem` & `OrderItem` — Trường `width`, `height`** — Hiện tại có trường `width` và `height` trong cả `QuotationItem` và `OrderItem`. Xác nhận **giữ lại**

> [!IMPORTANT]
> **Q3: Module `production`** — Đây có phải là module quản lý sản xuất nội bộ (như xưởng sản xuất).

> [!IMPORTANT]
> **Q4: Media Files (Image/Logo)** — Django media files cần cấu hình `MEDIA_ROOT`. Tôi muốn dùng **local storage**
---

## Verification Plan

### Sau khi được duyệt, tôi sẽ thực hiện theo thứ tự:
1. Cập nhật `requirements.txt` — thêm `channels`, `daphne`, `pillow`
2. Viết lại toàn bộ **models.py** của 6 app + tạo app `notifications` mới
3. Cập nhật `settings.py` — thêm `INSTALLED_APPS`, `CHANNEL_LAYERS`, `MEDIA_ROOT`
4. Tạo **management command** `seed_permissions` để seed dữ liệu permission
5. Chạy `makemigrations` + `migrate`
6. Kiểm tra: `python manage.py check` không có lỗi

B1:Kế hoạch & Thiết kế Cơ sở dữ liệu (Database Schema / Models)
B2:Backend API & Hệ thống Quota 
B3:Phát triển Frontend UI (Frontend UI Development & Backend Integration)
