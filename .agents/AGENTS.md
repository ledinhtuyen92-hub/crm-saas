# AGENTS.md - Project Rules for CRM SaaS

## 1. Maintenance Mode Principle (Chế độ Bảo trì Hệ thống)
- Khi hệ thống đang ở chế độ bảo trì (`maintenanceMode == true` từ hook `useAuth()` ở Frontend), TẤT CẢ các chức năng thêm, sửa, xóa, hoặc tạo mới dữ liệu ĐỀU PHẢI tuân thủ nguyên tắc:
  - **Ở Frontend:** Khi người dùng (không phải SuperAdmin) click vào nút "Thêm", "Tạo mới", "Sửa", hoặc bất kỳ nút nào dùng để mở form/modal nhập liệu, hệ thống phải CHẶN ngay lập tức (ví dụ: hiển thị thông báo `message.warning("⚠️ Hệ thống đang bảo trì dữ liệu. Chức năng này tạm thời bị khóa!")` hoặc nút bấm bị disabled) và KHÔNG cho phép mở form/modal nhập liệu.
  - **Mục đích:** Tránh việc người dùng mất thời gian điền thông tin vào form rồi khi bấm "Lưu" mới bị lỗi từ phía server.
  - **Lưu ý cho AI phát triển sau:** Bất kỳ module hay màn hình mới nào được tạo ra có chức năng Thêm/Sửa/Xóa dữ liệu đều phải import và kiểm tra `maintenanceMode` từ hook `useAuth()` trước khi mở Modal/Drawer nhập liệu.

## 2. Code-First Configuration (Cấu hình bằng Code)
- Bất kỳ cấu hình hệ thống, dữ liệu mặc định, hoặc phân quyền (permissions) mới nào ĐỀU PHẢI được khai báo cứng bằng code thay vì thao tác tay trên DB.
- Ví dụ: Khi thêm một Quyền (Permission) mới, BẮT BUỘC phải viết thêm vào mảng `PERMISSIONS` trong file `backend/users/management/commands/seed_permissions.py`.
- **Mục đích:** Đảm bảo khi làm việc trên nhiều máy/môi trường khác nhau (như kéo code từ công ty về nhà), hệ thống không bao giờ bị thiếu hụt dữ liệu (như mất quyền Zalo).
- Tuyệt đối hạn chế các thao tác manual dễ gây mất đồng bộ hoặc mất dữ liệu.

## 3. Mobile-First & Responsive Design (Tối ưu hóa Giao diện Di động)
- **Tất cả các module, trang, chức năng hoặc màn hình mới được tạo ra trên Frontend ĐỀU PHẢI tương thích hoàn hảo với thiết bị di động (Smartphones/Tablets).**
- **Quy tắc thực thi khi code Frontend:**
  - **Grid & Form:** Tuyệt đối không dùng fix cứng `span={12}` (hoặc tương tự) cho `Col` trong Grid/Form mà không có responsive. Phải dùng `xs={24} md={12}` để trên điện thoại các trường nhập liệu tự động dàn thành 1 cột dọc (100% width).
  - **Tables:** Mọi bảng dữ liệu (Table) bắt buộc phải có thuộc tính `scroll={{ x: 'max-content' }}` (hoặc một số pixel cụ thể) để tránh bị bóp méo chữ trên màn hình hẹp.
  - **Layout & Modal:** Modal phải có chiều rộng linh hoạt (Ant Design tự động xử lý tốt, nhưng không được fix cứng bằng px quá kích thước màn hình). Sidebar/Menu phải dùng cơ chế ẩn/Drawer trên mobile (đã được setup ở MainLayout).
  - **Charts:** Mọi biểu đồ đều phải được bọc trong `<ResponsiveContainer>`.

## 4. Đồng bộ Dữ liệu & Quyền trước khi Push lên GitHub
- **Bắt buộc:** Trước khi đẩy code lên GitHub, LUÔN LUÔN tạo file `sync_data.json` chứa toàn bộ dữ liệu hiện tại của database để đảm bảo khi pull code về máy khác chỉ cần nạp lại dữ liệu là hệ thống chạy bình thường.
- **Lệnh thực thi (chạy tại thư mục `backend/`):**
  ```powershell
  python manage.py dumpdata -e contenttypes -e auth.Permission -e sessions -e admin.logentry --indent 2 > sync_data.json
  ```
- **Lưu ý:** Việc này giúp đồng bộ dữ liệu cài đặt, cấu hình, dữ liệu người dùng và phân quyền giữa các môi trường làm việc.
