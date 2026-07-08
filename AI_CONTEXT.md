# AI_CONTEXT - Tài liệu Bối cảnh & Kiến trúc Hệ thống cho AI

**Tên dự án:** CRM SaaS (Nền tảng Quản lý Khách hàng & Bán hàng Đa doanh nghiệp)  
**Mô hình hoạt động:** Multi-tenant (Nhiều công ty sử dụng chung 1 Database, dữ liệu được cô lập chặt chẽ theo `company_id`).

---

## 1. Công nghệ sử dụng (Tech Stack)
* **Backend:** Python, Django Rest Framework (DRF), Django ORM.
* **Frontend:** ReactJS, Vite, Ant Design (UI Framework), Day.js.
* **Cơ sở dữ liệu:** PostgreSQL (Chạy trong container thông qua Docker).
* **Môi trường & Triển khai:** Docker, Docker-Compose.

---

## 2. Kiến trúc & Phân quyền (Users, Roles & Permissions)
Hệ thống sử dụng cơ chế phân quyền **RBAC (Role-Based Access Control)** kết hợp **Multi-tenant** bảo mật cao:
* **Mô hình Dữ liệu Core (`users` app):** `User` (Kế thừa AbstractUser), `Role` (Vai trò nội bộ công ty), `Permission` (Danh mục quyền hạn hệ thống).
* **Phân cấp Người dùng:**
  1. **Superuser (System Admin):** Quản trị toàn bộ nền tảng SaaS, tạo và quản lý các công ty (`Company`).
  2. **Company Admin (Giám đốc/Quản lý):** Toàn quyền trong nội bộ công ty (`company_id`). Có thể tự tạo Role và phân quyền cho nhân viên.
  3. **Staff (Nhân viên - VD: Sales, Kế toán):** Chỉ được thao tác dựa trên các quyền (`permissions`) được cấp thông qua Role của họ.
* **Kiểm tra quyền ở Frontend:** Sử dụng Hook `useAuth()`, gọi hàm `hasPermission('module.action')`. Ví dụ: `hasPermission('crm.view')`, `hasPermission('sales.create_quotation')`.
* **Script khởi tạo phân quyền chuẩn:** `backend/users/management/commands/seed_permissions.py`. Khi thêm Module hoặc Permission mới, **BẮT BUỘC** bổ sung vào script này và chạy lệnh `python manage.py seed_permissions`.

---

## 3. Các Module Tính năng Đã Hoàn thiện

### A. Module Khách hàng & Chăm sóc (CRM - `crm` app)
* **Quản lý Khách hàng & Leads:** Danh sách khách hàng, phân trang, lọc theo Trạng thái, lọc theo Sales phụ trách.
* **Gắn thẻ phân loại (Tags):** Gắn thẻ khách hàng với màu sắc động tùy chỉnh.
* **Lịch sử Chăm sóc (Customer Interactions & Timeline):** Ghi nhận các cuộc gọi, gặp mặt, báo giá gửi khách hiển thị dưới dạng Timeline.
* **Đính kèm tài liệu chăm sóc:** Upload nhiều file (PDF, Hình ảnh, Excel) lên từng lịch sử tương tác (Model `InteractionAttachment`).
* **Phân bổ Khách hàng (Assign Leads):** Giao việc cho Sales chăm sóc. Sales chỉ nhìn thấy khách hàng được phân công cho mình.

### B. Module Sản phẩm & Hàng hóa (`products` app)
* Quản lý danh mục sản phẩm, quy cách kích thước chuẩn (chiều rộng, chiều cao, độ dày - đơn vị số nguyên `mm`), đơn giá bán, đơn vị tính (`ĐVT`), hình ảnh sản phẩm.

### C. Module Bán hàng & Báo giá Động (`sales` app) - *CORE FEATURE*
* **Quản lý Báo giá (`Quotation` & `QuotationItem`):**
  * Tạo báo giá liên kết với Khách hàng (`customer`) và danh sách sản phẩm/dịch vụ chi tiết (`items`).
  * Hỗ trợ các trường kích thước/quy cách chuyên sâu (`width`, `height`, `thickness`), số lượng (`quantity`), đơn vị tính (`unit`), đơn giá (`unit_price`), chiết khấu dòng (`discount_percent`), ghi chú dòng (`note`).
  * Thông tin khách hàng & ngày lắp đặt dự kiến (`installation_date`).
* **Hệ thống Quản lý & Trình thiết kế Mẫu Báo Giá (`QuotationTemplateManagement.jsx`):**
  * Hỗ trợ đa dạng cấu hình khổ giấy: **Khổ Ngang A4 (Landscape)** và **Khổ Dọc A4 (Portrait)**.
  * **Kho Mẫu Báo Giá Hệ Thống (`SYSTEM_TEMPLATES`):** Cung cấp sẵn mẫu chuẩn SaaS (Ngang & Dọc) để công ty xem trước và áp dụng với 1 click.
  * **Cơ chế Đóng băng Mẫu (`template_snapshot`):** Khi một Báo giá được tạo/mở xem lần đầu, hệ thống tự động lưu trữ cấu trúc mẫu lúc đó vào `custom_data.template_snapshot`. Nhờ đó, nếu công ty thay đổi mẫu mặc định sau này (từ Ngang sang Dọc hay ngược lại), các báo giá cũ vẫn hiển thị nguyên vẹn theo mẫu cũ, không bao giờ bị lệch cột hay lỗi hiển thị.

---

## 4. Chuẩn mực Thiết kế & Giao diện Báo giá (Quotation UI/UX)

### A. Mẫu Báo Giá Khổ Dọc A4 (Portrait A4 - Drawer Width `920px`)
* **Bảng hạng mục 8 cột chuẩn tối ưu:**
  1. `STT` (`42px`, canh giữa)
  2. `Sản phẩm / Hàng hoá` (`240px` - rộng nhất bảng, đảm bảo tên sản phẩm dài không bị xuống dòng lẻ tẻ)
  3. `Kích thước / Ghi chú` (`175px` - hiển thị độc lập chi tiết quy cách/ghi chú)
  4. `ĐVT` (`55px`, bộ/cái/m²...)
  5. `SL` (`48px`)
  6. `Đơn giá` (`110px`, canh phải)
  7. `CK%` (`50px`)
  8. `Thành tiền` (`125px`, canh phải, chữ xanh lá nổi bật)
* **Thẻ Thông tin Khách hàng / Đối tác (Compact Inline Banner):**
  * Bố cục Banner gọn gàng (tiết kiệm >50% chiều cao vertical space so với dạng Card cũ).
  * Header Banner tích hợp tiêu đề và **Ngày lắp đặt dự kiến** bên góc phải.
  * Các trường thông tin Khách hàng, Điện thoại, Địa chỉ, Email hiển thị theo cặp inline thẳng hàng, không chứa các thông tin quản trị nội bộ CRM (như Trạng thái báo giá Nháp/Đã gửi).

### B. Mẫu Báo Giá Khổ Ngang A4 (Landscape A4 - Drawer Width `1080px`)
* Bố cục trải rộng 2 thẻ song song (Bên Bán - Bên Mua).
* **Ngày lắp đặt dự kiến** được bố trí ở dòng dưới cùng của khối địa chỉ Bên Mua (`BÊN A`), tránh hiển thị trùng lặp trên tiêu đề.
* Bảng hạng mục hiển thị đầy đủ thông số kích thước (Cao x Rộng x Dày mm), đơn giá, chiết khấu và thành tiền.

---

## 5. Nguyên tắc Quản trị & Bảo trì Hệ thống (Maintenance Mode Principle)
* **Quy tắc Bảo trì Dữ liệu (`maintenanceMode == true` trong `useAuth()`):**
  * Khi Superuser kích hoạt chế độ bảo trì hệ thống, **TẤT CẢ** các thao tác Thêm mới, Sửa, hoặc tạo dữ liệu ở Frontend đều bị chặn ngay lập tức tại thời điểm người dùng click nút mở Modal/Drawer nhập liệu (hiển thị thông báo cảnh báo và không mở form).
  * Mục đích: Ngăn người dùng mất thời gian nhập liệu vào form rồi khi ấn Lưu mới bị từ chối từ Server.
  * Bất kỳ module hay màn hình mới nào được phát triển sau này đều phải kiểm tra `maintenanceMode` trước khi cho phép mở form.

---

## 6. Quy trình Đồng bộ Dữ liệu & Môi trường làm việc
* Khi chuyển đổi máy tính hoặc khôi phục dữ liệu đồng bộ trên Docker:
  ```bash
  # 1. Flush dữ liệu cũ (nếu cần re-seed)
  docker-compose exec web python manage.py flush --no-input
  # 2. Đồng bộ quyền hạn mặc định
  docker-compose exec web python manage.py seed_permissions
  ```

---

## 7. Hướng dẫn dành cho AI kế nhiệm (Next AI Developer Guidelines)
1. **Tuân thủ tuyệt đối Multi-tenant:** Khi viết API hay truy vấn DB, luôn đảm bảo lọc `company_id` từ `request.user` (trừ Superuser).
2. **Quyền hạn không hardcode:** Luôn tạo Role-Permission rõ ràng trong `seed_permissions.py` và kiểm tra qua `hasPermission()`.
3. **Bảo toàn Snapshot Báo giá:** Khi render màn hình Báo giá, luôn ưu tiên đọc `getEffectiveTemplate(quotation)` (dùng `template_snapshot` nếu có) để bảo vệ toàn vẹn lịch sử báo giá.
4. **Sử dụng Tool Edit code chính xác:** Sử dụng `replace_file_content` hoặc `multi_replace_file_content` để chỉnh sửa chính xác từng khối code, giữ nguyên indentation và import.