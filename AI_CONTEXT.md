# AI_CONTEXT - Tài liệu Bối cảnh cho AI

**Tên dự án:** CRM SaaS (Nền tảng Quản lý khách hàng Đa doanh nghiệp)
**Mô hình hoạt động:** Multi-tenant (Nhiều công ty chung 1 Database, dữ liệu được cô lập bằng `company_id`).

---

## 1. Công nghệ sử dụng (Tech Stack)
* **Backend:** Python, Django Rest Framework (DRF).
* **Frontend:** ReactJS, Vite, Ant Design (UI Framework).
* **Cơ sở dữ liệu:** PostgreSQL (Chạy qua Docker).
* **Môi trường & Quản lý:** Docker, Docker-Compose.

---

## 2. Kiến trúc & Phân quyền (Users & Permissions)
Hệ thống sử dụng cơ chế phân quyền RBAC (Role-Based Access Control) kết hợp Multi-tenant cực kỳ chặt chẽ:
* **Mô hình Dữ liệu Core:** `User` (Kế thừa AbstractUser), `Role` (Vai trò), `Permission` (Quyền hạn hệ thống).
* **Phân cấp Người dùng:**
  1. **Superuser (System Admin):** Quản lý toàn hệ thống, tạo công ty mới.
  2. **Company Admin (Giám đốc/Quản lý):** Toàn quyền trong nội bộ công ty của họ (dựa vào `company_id`). Có thể tự tạo Role và phân quyền cho nhân viên.
  3. **Staff (Nhân viên - VD: Sales):** Chỉ được thao tác dựa trên các quyền (`permissions`) được cấp thông qua Role.
* **Cách Frontend check quyền:** Sử dụng Hook `useAuth()`, gọi hàm `hasPermission('module.action')`. VD: `hasPermission('crm.view')`.
* **Script khởi tạo phân quyền mặc định:** `backend/users/management/commands/seed_permissions.py`. Nếu AI tạo thêm Permission mới, **BẮT BUỘC** phải add vào script này và chạy lệnh `python manage.py seed_permissions`.

---

## 3. Các Module tính năng đã hoàn thiện

### A. Module Khách hàng & Leads (CRM)
* **Quản lý khách hàng:** Danh sách KH, phân trang, lọc theo Trạng thái, Lọc theo Sale phụ trách.
* **Gắn thẻ (Tags):** Gắn thẻ phân loại khách hàng với màu sắc động.
* **Timeline Lịch sử chăm sóc (Interactions):** Ghi chú lại lịch sử gọi điện/gặp mặt khách hàng, được hiển thị dưới dạng Timeline.
* **[Mới] Đính kèm File Lịch sử chăm sóc:** Nhân viên có thể upload nhiều file (PDF, Hình ảnh, Excel) lên từng lịch sử chăm sóc. 
  * Cần quyền `crm.upload_interaction_files` (Có thể bật/tắt trong màn RoleManagement).
  * Backend model xử lý: `InteractionAttachment` (Liên kết ForeignKey với `CustomerInteraction`).
* **[Mới] Giao việc (Assign):** Phân bổ khách hàng cho Sales chăm sóc. Sales chỉ được xem khách hàng của chính mình (nhờ check quyền `assigned_to` trên QuerySet).

### B. Module Thông báo (Notifications)
* Khi một khách hàng được chia cho Sales, một hệ thống Thông báo (Notification) tự động gửi đến Sales.
* Có icon chuông đỏ thông báo tin nhắn chưa đọc ở góc trên bên phải màn hình.

### C. UI / UX Tùy chỉnh (Frontend)
* Header (Topbar) trang chủ sử dụng thông điệp chào mừng động (Dynamic Greeting) thay đổi theo chức năng của người dùng (Admin, Giám đốc, Sales) cùng hiệu ứng màu sắc Gradient đẹp mắt.
* Ứng dụng hỗ trợ Dark Mode / Light Mode mượt mà.

---

## 4. Dữ liệu & Đồng bộ
* Hình ảnh và tài liệu upload được lưu ở thư mục `backend/media/`.
* **Sync Data:** Khi thay đổi môi trường máy tính, User sẽ dùng lệnh:
  1. Xóa data cũ: `docker-compose exec web python manage.py flush`
  2. Load data đồng bộ: `docker-compose exec web python manage.py loaddata sync_data.json`

---

## 5. Quy ước dành cho AI (Guidelines for next AI)
Nếu bạn là một phiên bản AI mới đang đọc tài liệu này để làm việc với User, hãy chú ý:
1. **Bảo toàn dữ liệu cũ:** Bất cứ khi nào tạo Model mới, đừng quên tạo Migration và luôn kiểm tra logic multi-tenant (`company_id`).
2. **Quyền hạn (Permissions):** Không hardcode quyền. Khi làm tính năng mới, hãy tạo Role-Permission mới ở `seed_permissions.py`, chạy lệnh seed, rồi mới gắn vào Frontend.
3. **Thao tác API:** Các ViewSet ở backend luôn phải ghi đè `get_queryset()` để lọc `company_id = self.request.user.company_id` (Ngoại trừ Superuser).
4. **Tool ưu tiên:** Sử dụng `multi_replace_file_content` hoặc `replace_file_content` để edit code chính xác, tránh ghi đè làm mất import cũ.
5. Luôn đề cao trải nghiệm người dùng (UI/UX) với Ant Design, dùng màu sắc bắt mắt (gradients).

*Bản tóm tắt này chứa đầy đủ tư duy hệ thống đã xây dựng. Hãy tiếp tục công việc từ nền tảng vững chắc này!*