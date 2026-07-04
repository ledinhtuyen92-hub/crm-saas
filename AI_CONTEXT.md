# CRM SaaS — Tài liệu Kiến trúc & Phát triển Hệ thống

> **Dành cho AI đọc tiếp**: Đây là tài liệu đầy đủ và chính xác về hệ thống CRM SaaS đã được phát triển. Hãy đọc kỹ toàn bộ file này trước khi bắt đầu bất kỳ tác vụ phát triển nào. Code thực tế tại `d:\LẬP TRÌNH\crm_saas`.

---

## 1. Tổng Quan Hệ thống

**CRM SaaS** là phần mềm quản lý quan hệ khách hàng theo mô hình **Multi-tenant SaaS**. Mỗi công ty khách hàng ("tenant") có workspace riêng biệt, dữ liệu cô lập hoàn toàn.

### Stack Kỹ thuật

| Tầng | Công nghệ |
|------|-----------|
| **Backend** | Django 5.2 + Django REST Framework |
| **Frontend** | React (Vite) + Ant Design UI + Recharts |
| **Database** | PostgreSQL 15 |
| **Realtime** | Django Channels + Redis |
| **Auth** | JWT (SimpleJWT) |
| **Container** | Docker + Docker Compose |

### Cách chạy hệ thống

```bash
# 1. Khởi động Backend + DB + Redis (bật Docker Desktop trước)
docker-compose up -d

# 2. Khởi động Frontend (terminal riêng)
cd frontend && npm run dev

# 3. Tắt
docker-compose down

# Xem log backend
docker-compose logs -f web

# Tạo superuser hệ thống
docker exec -it crm_web python manage.py createsuperuser

# Chạy migration sau khi thay đổi model
docker exec crm_web python manage.py makemigrations
docker exec crm_web python manage.py migrate

# Restart backend để load code mới
docker-compose restart web
```

---

## 2. Kiến trúc Backend (Django)

### 2.1 Cấu trúc thư mục Backend

```
backend/
├── core/                  # Django project root
│   ├── settings.py        # DB, JWT, CORS, REST_FRAMEWORK, Middleware
│   ├── urls.py            # Root URL dispatcher
│   └── numbering.py       # Hàm generate mã đơn hàng tự động
├── users/                 # App quản lý người dùng & công ty (TRUNG TÂM)
├── crm/                   # App quản lý khách hàng & Leads
├── sales/                 # App báo giá (Quotation)
├── orders/                # App đơn hàng (Order)
├── inventory/             # App kho bãi & sản phẩm
├── production/            # App quản lý sản xuất
├── dashboard/             # App thống kê & biểu đồ Dashboard
└── notifications/         # App thông báo (WebSocket)
```

### 2.2 App `users` — Trung tâm của hệ thống

**File**: `users/models.py`

#### `Company` (Công ty / Tenant)
- `name`, `workspace_id` (slug unique, tự tạo từ tax_code), `tax_code` (unique)
- `address`, `phone`, `logo`
- `is_active` — Khóa/mở khoá công ty
- `user_limit` — Giới hạn số nhân viên (null = không giới hạn)
- `created_at`

#### `Permission` (Quyền)
- `code` (unique) — VD: `crm.view_all`, `orders.approve`, `inventory.view`
- `name`, `module` — Tên hiển thị và module chứa quyền

#### `Role` (Vai trò — thuộc về 1 company)
- `company` FK, `name`, `description`
- `permissions` M2M(Permission) — Danh sách quyền được gán

#### `User` (extends AbstractUser)
- `email` (unique), `full_name`, `phone`, `job_title`, `avatar`
- `company` FK — null nếu là SuperAdmin hệ thống
- `role` FK(Role)
- `is_company_admin: BooleanField` — True = Giám đốc/Owner của công ty

**Phân cấp quyền (quan trọng)**:
```
is_superuser=True     → System Admin (không có company) — quản trị toàn hệ thống
is_company_admin=True → Company Admin (Giám đốc) — toàn quyền trong workspace
role.permissions      → Nhân viên thường — bị giới hạn bởi Role
```

**Phương thức quan trọng trên User:**
```python
user.has_perm_code("crm.view_all")  # Kiểm tra nhanh 1 permission
user.get_permission_codes()          # Trả về set tất cả permission codes
```

#### `SubscriptionPlan` (Gói đăng ký)
- `code` (unique), `name`, `user_limit`, `is_default`, `created_at`
- **Gói mặc định** (is_default=True, không xoá được): `starter (5 users)`, `business (20 users)`, `enterprise (99999)`
- Admin hệ thống tạo thêm **gói tuỳ chỉnh** từ giao diện `/admin/settings`

#### `SystemSettings` (Cấu hình hệ thống — Singleton, pk=1)
- `require_strong_password` — Yêu cầu mật khẩu mạnh
- `enable_public_registration` — Bật/tắt trang đăng ký công ty mới
- `default_plan`, `default_user_limit` — Gói & giới hạn mặc định khi đăng ký
- `tenant_isolation_mode` — `"strict"` (mặc định) hoặc `"relaxed"`
- `jwt_expiration_hours` — Thời gian hết hạn phiên JWT (thực sự áp dụng)
- `max_file_upload_mb` — Giới hạn file upload (thực sự áp dụng qua Middleware)

#### `CompanySettings` (Cấu hình công ty — 1:1 với Company)
- `order_prefix` — Tiền tố mã đơn hàng (VD: "DH" → DH-20240101-001)
- `lead_routing` — `"manual"` hoặc `"round_robin"`
- `timezone`

### 2.3 TenantQuerySetMixin — Cô lập dữ liệu (QUAN TRỌNG)

**File**: `users/views.py`

```python
class TenantQuerySetMixin:
    """
    Mọi ViewSet xử lý dữ liệu của công ty PHẢI kế thừa mixin này.
    Tự động filter queryset theo company của user đang đăng nhập.
    
    Modes:
    - "strict": Mọi user chỉ thấy data của company mình
    - "relaxed": Superuser thấy tất cả data (dùng khi hỗ trợ kỹ thuật)
    """
```

### 2.4 Middleware đang hoạt động

```python
# users/middleware.py
class FileUploadLimitMiddleware:
    # Chặn request vượt quá SystemSettings.max_file_upload_mb * 1024 * 1024 bytes
```

### 2.5 Authentication

- `POST /api/users/token/` — Đăng nhập, nhận access + refresh token
- `POST /api/users/token/refresh/` — Làm mới token
- **CustomTokenObtainPairSerializer** trong `users/serializers.py`:
  - Kiểm tra `is_active` của user
  - Kiểm tra `is_active` của company
  - Áp dụng `jwt_expiration_hours` từ SystemSettings vào thời gian hết hạn token

---

## 3. App `crm` — Quản lý Khách hàng

**Files**: `crm/models.py`, `crm/serializers.py`, `crm/views.py`

### Model `Customer`
```
company (FK), name, phone, email, address, city
source: [facebook, zalo, referral, walk_in, website, other]
  → Nguồn khách marketing — do Sale TỰ CHỌN khi tạo, không tự động
status: [new, potential, active, lost, inactive]
tags (M2M CustomerTag)
assigned_to (FK User, related_name="assigned_customers") — Nhân viên phụ trách
created_by (FK User, related_name="created_customers") — Người tạo record
notes
```

### API Actions
```
GET/POST   /api/crm/customers/                     # CRUD
POST       /api/crm/customers/{id}/assign/         # Phân công thủ công {assigned_to: user_id}
POST       /api/crm/customers/round-robin-assign/  # Phân bổ tự động (chỉ CompanyAdmin)
GET/POST   /api/crm/contacts/                      # Đầu mối liên hệ phụ
GET/POST   /api/crm/interactions/                  # Lịch sử chăm sóc
```

### Lưu ý Serializer `CustomerSerializer`
- `assigned_to` (read): Trả về nested object `{id, full_name, username}`
- `assigned_to_id` (write-only): Nhận integer ID khi ghi
- `created_by` (read): Trả về nested object `{id, full_name, username}`
- `source_display`: Tên đầy đủ của source (VD: "Facebook", "Giới thiệu")

---

## 4. App `orders` — Đơn hàng

### Model `Order`
```
company (FK), customer (FK), quotation (FK nullable)
order_number (auto-generated từ core/numbering.py)
created_by, approved_by (FK User)
status: [pending, approved, rejected, in_production, completed, cancelled]
total_amount (DecimalField)
```

### API Actions
```
POST /api/orders/{id}/approve/  # Duyệt (cần quyền orders.approve hoặc is_company_admin)
POST /api/orders/{id}/reject/   # Từ chối
```

---

## 5. App `dashboard` — Thống kê

**File**: `backend/dashboard/views.py`

```
GET /api/dashboard/summary/
    → customers: {total, new_today, by_status_*}
    → quotations: {total, draft, sent, accepted, rejected, win_rate(%)}
    → orders: {total, pending, approved, completed, revenue_this_month,
               revenue_today, total_revenue_all_time}
    → inventory: {low_stock_count}
    → employees: {total_active}

GET /api/dashboard/revenue-chart/?period=6
    → [{month: "2026-01", revenue: 50000000, count: 3}, ...]

GET /api/dashboard/orders-by-status/
    → [{status: "pending", label: "Chờ duyệt", count: 5}, ...]

GET /api/dashboard/top-sellers/?limit=N
    → [{user_id, full_name, total_revenue, order_count}, ...]  # Sắp giảm dần

GET /api/dashboard/top-customers/?limit=N
    → [{customer_id, name, phone, total_revenue, order_count}, ...]
```

---

## 6. Cấu trúc Frontend (React + Vite)

```
frontend/src/
├── App.jsx                 # Router chính, tất cả routes
├── contexts/AuthContext.jsx # Auth state: JWT, user info, permissions
├── components/
│   ├── MainLayout.jsx      # Layout chính (sidebar + header) cho user thường
│   └── ProtectedRoute.jsx  # HOC: ProtectedRoute, SuperAdminRoute, CompanyAdminRoute
├── utils/api.js            # Axios instance (baseURL: http://localhost:8000/api/)
└── pages/
    ├── Login.jsx           # Đăng nhập: workspace_id + username + password
    ├── RegisterCompany.jsx # Đăng ký công ty mới
    ├── Dashboard.jsx       # Dashboard Giám đốc (dữ liệu real-time)
    ├── CustomerList.jsx    # Quản lý khách hàng & Leads
    ├── QuotationList.jsx   # Báo giá
    ├── OrderList.jsx       # Đơn hàng
    ├── Inventory.jsx       # Kho bãi & sản phẩm
    ├── ProductionList.jsx  # Sản xuất
    ├── admin/
    │   ├── AdminDashboard.jsx         # Dashboard System Admin
    │   ├── AdminSettings.jsx          # Cấu hình hệ thống + Gói đăng ký
    │   ├── CompanyManagement.jsx      # CRUD công ty khách hàng SaaS
    │   ├── SystemUserManagement.jsx   # CRUD tài khoản toàn hệ thống
    │   └── SubscriptionPlanManager.jsx # CRUD gói đăng ký tuỳ chỉnh
    └── settings/
        ├── UserManagement.jsx  # Quản lý nhân viên (CompanyAdmin)
        └── RoleManagement.jsx  # Quản lý vai trò & phân quyền
```

### Routes

| Route | Component | Quyền |
|-------|-----------|-------|
| `/login` | Login.jsx | Public |
| `/register` | RegisterCompany.jsx | Public (nếu bật) |
| `/dashboard` | Dashboard.jsx | Đăng nhập (non-SuperAdmin) |
| `/customers` | CustomerList.jsx | Đăng nhập |
| `/quotations` | QuotationList.jsx | Đăng nhập |
| `/orders` | OrderList.jsx | Đăng nhập |
| `/inventory` | Inventory.jsx | Đăng nhập |
| `/settings/users` | UserManagement.jsx | CompanyAdmin |
| `/settings/roles` | RoleManagement.jsx | CompanyAdmin |
| `/admin/dashboard` | AdminDashboard.jsx | **SuperAdmin only** |
| `/admin/companies` | CompanyManagement.jsx | **SuperAdmin only** |
| `/admin/users` | SystemUserManagement.jsx | **SuperAdmin only** |
| `/admin/settings` | AdminSettings.jsx | **SuperAdmin only** |

---

## 7. Các Tính năng Đã Hoàn thiện

### System Admin (SuperAdmin)

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Dashboard thống kê hệ thống | ✅ | Số công ty, tài khoản, tăng trưởng tháng |
| Quản lý công ty (CRUD) | ✅ | Tạo kèm tài khoản Giám đốc, khoá/mở, xoá |
| Đổi gói đăng ký công ty | ✅ | Danh sách gói dynamic từ API |
| Quản lý tài khoản hệ thống | ✅ | Khoá/mở, đặt lại mật khẩu |
| Cấu hình hệ thống | ✅ | Tất cả settings thực sự áp dụng backend |
| Khoá trang đăng ký mới | ✅ | UI bị khoá + thông báo |
| Gói đăng ký tuỳ chỉnh (CRUD) | ✅ | Gói mặc định không xoá được |

### Company Admin (Giám đốc)

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Dashboard real-time | ✅ | 5 KPI, 2 biểu đồ, bảng xếp hạng Sale, 10 đơn mới nhất |
| Quản lý nhân viên (CRUD) | ✅ | Giới hạn theo user_limit |
| Quản lý vai trò & quyền | ✅ | CRUD vai trò, gán quyền |
| Phân công khách thủ công | ✅ | Chọn Sale cho từng khách |
| Phân bổ khách tự động | ✅ | Round-robin đều cho các Sale |

### Khách hàng (CRM)

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Danh sách với cột Địa chỉ | ✅ | |
| Cột Nguồn: icon + kênh + người tạo | ✅ | |
| Cột Phụ trách: tên đầy đủ hoặc "Chưa có" | ✅ | |
| Thêm/Sửa/Xoá khách | ✅ | |
| Drawer chi tiết: lịch sử chăm sóc, đầu mối | ✅ | |
| Lọc theo trạng thái, tìm kiếm | ✅ | |

---

## 8. Quy ước & Patterns Quan trọng

### Xử lý Pagination ở Frontend (BẮT BUỘC)
```javascript
// Backend bật PageNumberPagination với PAGE_SIZE=20
// Response có thể là array hoặc {count, next, previous, results: [...]}
const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
```

### Pattern Nested Serializer (cho User objects)
```python
# Khi muốn trả về {id, full_name, username} thay vì integer ID:
class SomeUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    username = serializers.CharField()

class MySerializer(serializers.ModelSerializer):
    some_user = SomeUserSerializer(read_only=True)       # ĐỌC: nested object
    some_user_id = serializers.PrimaryKeyRelatedField(   # GHI: nhận ID
        queryset=User.objects.all(),
        source="some_user",
        write_only=True,
    )
```

### Pattern TenantQuerySetMixin
```python
class MyViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = MyModel.objects.select_related("company")
    # get_company() → trả về company của user hiện tại
```

### Thêm ViewSet mới vào URLs
```python
# users/urls.py (hoặc app tương ứng)
router.register("my-endpoint", MyViewSet, basename="my-endpoint")
```

---

## 9. Các Module Cần Phát triển Tiếp

| Module | Ưu tiên | Mô tả |
|--------|---------|-------|
| Import Excel khách hàng | Cao | Endpoint riêng, đặt `created_by=request.user` |
| Báo cáo & Xuất Excel/PDF | Cao | Doanh thu, hiệu suất Sale, tồn kho |
| Email notification | Trung bình | Khi có đơn mới, khi được phân công khách |
| Facebook Lead Ads integration | Trung bình | Webhook nhận lead, tạo Customer tự động |
| Thông báo realtime (WebSocket) | Trung bình | Django Channels + Redis đã cấu hình sẵn |
| Mobile responsive | Thấp | UI đang tối ưu cho desktop |
| Đa ngôn ngữ (i18n) | Thấp | |
| Two-factor authentication | Thấp | |

---

## 10. Thông tin Kỹ thuật Bổ sung

### Database
- **Engine**: PostgreSQL 15 (qua Docker, container `crm_db`)
- **Kết nối**: host=`db`, port=5432, user=`postgres`, pass=`123`, db=`crm_db`

### Docker Containers
- `crm_db` — PostgreSQL database
- `crm_redis` — Redis (cho Channels)
- `crm_web` — Django app server (port 8000)

### CORS
```python
CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
CORS_ALLOW_CREDENTIALS = True
```

### Default Admin Account
- Tạo bằng: `docker exec -it crm_web python manage.py createsuperuser`
- Tài khoản này có `is_superuser=True`, KHÔNG có `company`

### Sync dữ liệu giữa các máy
```bash
# Xuất dữ liệu
docker exec -it crm_web python manage.py dumpdata > sync_data.json
git add . && git commit -m "sync" && git push

# Nhập dữ liệu vào máy khác
git pull
docker exec -it crm_web python manage.py loaddata sync_data.json
```