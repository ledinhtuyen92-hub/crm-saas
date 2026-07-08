# AGENTS.md - Project Rules for CRM SaaS

## 1. Maintenance Mode Principle (Chế độ Bảo trì Hệ thống)
- Khi hệ thống đang ở chế độ bảo trì (`maintenanceMode == true` từ hook `useAuth()` ở Frontend), TẤT CẢ các chức năng thêm, sửa, xóa, hoặc tạo mới dữ liệu ĐỀU PHẢI tuân thủ nguyên tắc:
  - **Ở Frontend:** Khi người dùng (không phải SuperAdmin) click vào nút "Thêm", "Tạo mới", "Sửa", hoặc bất kỳ nút nào dùng để mở form/modal nhập liệu, hệ thống phải CHẶN ngay lập tức (ví dụ: hiển thị thông báo `message.warning("⚠️ Hệ thống đang bảo trì dữ liệu. Chức năng này tạm thời bị khóa!")` hoặc nút bấm bị disabled) và KHÔNG cho phép mở form/modal nhập liệu.
  - **Mục đích:** Tránh việc người dùng mất thời gian điền thông tin vào form rồi khi bấm "Lưu" mới bị lỗi từ phía server.
  - **Lưu ý cho AI phát triển sau:** Bất kỳ module hay màn hình mới nào được tạo ra có chức năng Thêm/Sửa/Xóa dữ liệu đều phải import và kiểm tra `maintenanceMode` từ hook `useAuth()` trước khi mở Modal/Drawer nhập liệu.
