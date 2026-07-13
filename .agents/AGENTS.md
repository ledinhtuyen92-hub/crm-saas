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
