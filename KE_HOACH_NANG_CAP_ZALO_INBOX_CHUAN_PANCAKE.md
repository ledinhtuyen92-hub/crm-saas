# Kế hoạch Nâng Cấp Toàn Diện Zalo Inbox (`ZaloInboxPage.jsx`) Lên Chuẩn Đẳng Cấp Pancake CRM

> **Dự án:** CRM SaaS (Django + React/Vite)  
> **Module:** Zalo Integration (`backend/zalo_integration` & `frontend/src/pages/ZaloInboxPage.jsx`)  
> **Mục tiêu:** Đồng bộ trọn bộ 6 tính năng vàng và kiến trúc UI/UX chuyên nghiệp từ Facebook Inbox sang Zalo Inbox.

---

## 🎯 Mục Tiêu & Lợi Ích
1. **⭐ Đánh dấu Khách VIP / Ưu tiên:** Giúp Sale/Quản lý ghim và lọc nhanh các hội thoại Zalo quan trọng chỉ với 1 cú nhấp chuột.
2. **🏷️ Phân loại hội thoại bằng Nhãn Đa Màu Sắc (Multi-Color Tags):** Cho phép tạo nhãn tùy biến theo quy trình bán hàng (*VD: Khách sỉ, Đã chuyển khoản, Hẹn gọi lại, Khách khó tính*) và gán nhiều nhãn cho một hội thoại Zalo.
3. **📝 Ghi Chú Nội Bộ (Internal Notes):** Lưu vết trao đổi giữa các ca làm việc hoặc giữa Sale và Quản lý ngay tại từng hội thoại Zalo mà khách hàng không nhìn thấy.
4. **⚡ Thư Viện Văn Bản Mẫu & Gõ Phím Tắt (`/phimtat`):** Tăng tốc trả lời tin nhắn Zalo gấp 5 lần nhờ menu gợi ý khi gõ phím `/` và kho tin nhắn mẫu.
5. **📧 & 🏠 Bóc tách & Hiển thị Huy hiệu SĐT, Email, Địa chỉ:** Tận dụng dữ liệu bóc tách từ tin nhắn Zalo để hiển thị huy hiệu 3-in-1 dưới tên khách và cho phép điền nhanh sang hồ sơ Khách hàng CRM.
6. **🎨 Đồng bộ Giao diện Thanh công cụ & Cột phải:** Đưa thanh công cụ icon tròn phía trên khung chat và Cột phải 2 tab (`Thông tin` & `Ghi chú nội bộ`) chuẩn mực vào Zalo Inbox.

---

## 🏗️ PHẦN 1: THIẾT KẾ CƠ SỞ DỮ LIỆU & BACKEND (`backend/zalo_integration`)

### 1.1. Cập Nhật Models (`models.py`)
1. **Bổ sung vào `SocialLead` (Hội thoại Zalo):**
   ```python
   is_starred = models.BooleanField(
       default=False, 
       verbose_name="Đánh dấu Khách VIP / Gấp",
       db_index=True
   )
   tags = models.ManyToManyField(
       "ZaloLeadTag", 
       blank=True, 
       related_name="social_leads", 
       verbose_name="Nhãn hội thoại"
   )
   ```
2. **Model mới `ZaloLeadTag` (Nhãn phân loại hội thoại Zalo):**
   ```python
   class ZaloLeadTag(models.Model):
       company = models.ForeignKey("users.Company", on_delete=models.CASCADE, related_name="zalo_lead_tags")
       name = models.CharField(max_length=50, verbose_name="Tên nhãn")
       color = models.CharField(max_length=20, default="#3b82f6", verbose_name="Màu sắc (HEX)")
       created_at = models.DateTimeField(auto_now_add=True)

       class Meta:
           unique_together = [("company", "name")]
           ordering = ["name"]
   ```
3. **Model mới `ZaloLeadNote` (Ghi chú nội bộ hội thoại Zalo):**
   ```python
   class ZaloLeadNote(models.Model):
       lead = models.ForeignKey("SocialLead", on_delete=models.CASCADE, related_name="internal_notes")
       user = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
       content = models.TextField(verbose_name="Nội dung ghi chú")
       created_at = models.DateTimeField(auto_now_add=True)

       class Meta:
           ordering = ["-created_at"]
   ```
4. **Model mới `ZaloQuickReply` (Văn bản tin nhắn mẫu Zalo):**
   ```python
   class ZaloQuickReply(models.Model):
       company = models.ForeignKey("users.Company", on_delete=models.CASCADE, related_name="zalo_quick_replies")
       shortcut = models.CharField(max_length=50, blank=True, verbose_name="Cú pháp gõ tắt (vd: /banggia)")
       title = models.CharField(max_length=100, verbose_name="Tiêu đề mẫu tin")
       content = models.TextField(verbose_name="Nội dung tin nhắn")
       created_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
       created_at = models.DateTimeField(auto_now_add=True)

       class Meta:
           ordering = ["title"]
   ```

### 1.2. Cập Nhật Serializers & ViewSets (`serializers.py` & `views.py`)
1. **`ZaloLeadTagSerializer`, `ZaloLeadNoteSerializer`, `ZaloQuickReplySerializer`**: Xây dựng đầy đủ CRUD.
2. **`SocialLeadSerializer`**:
   - Trả về danh sách `tags` (nested id, name, color).
   - Trả về `is_starred`.
   - Trả về số lượng hoặc danh sách `internal_notes`.
3. **Các Custom Actions trên `SocialLeadViewSet` (`/api/zalo/social-leads/`)**:
   - `POST /{id}/toggle_star/`: Bật/tắt trạng thái VIP (`is_starred`).
   - `POST /{id}/manage_tags/`: Nhận danh sách tag IDs hoặc tên tag để gắn/tháo nhãn cho hội thoại.
   - `GET/POST /{id}/notes/`: Lấy danh sách ghi chú hoặc thêm ghi chú nội bộ mới.
   - `POST /{id}/assign/`: Cập nhật nhân viên phụ trách (`assigned_to`).

---

## 🎨 PHẦN 2: NÂNG CẤP GIAO DIỆN FRONTEND (`ZaloInboxPage.jsx`)

### 2.1. Cấu Trúc Bố Cục Đa Năng 4 Cột (Đồng Bộ 100% với Facebook Inbox)
1. **Cột 1: Vertical Filter Sidebar (Thanh lọc dọc bên trái cùng):**
   - Nút `💬 Tất cả hội thoại`.
   - Nút `⭐ Khách VIP / Gấp` (Lọc `is_starred == true`).
   - Nút `🏷️ Lọc theo Nhãn` (Dropdown chọn màu/tên nhãn).
   - Nút `👤 Lọc theo Sale` (Chỉ hội thoại của tôi hoặc chọn Sale cụ thể).
2. **Cột 2: Danh Sách Hội Thoại (`Conversation List`):**
   - Hiển thị ngôi sao `⭐` vàng nếu khách là VIP bên cạnh tên hoặc thời gian.
   - Hiển thị các viên thuốc nhãn màu (`Tag Pill`) ngay dưới tên khách.
   - Hiển thị huy hiệu nhận dạng: `📞 {detected_phone} | 📧 {detected_email} | 🏠 {detected_address}`.
3. **Cột 3: Khung Chat & Thanh Công Cụ Nhập Liệu Compact (`Chat Box`):**
   - **Thanh công cụ Icon tròn phía trên ô gõ:**
     - `📞` (PhoneOutlined + Tooltip "Yêu cầu SĐT").
     - `📧` (MailOutlined + Tooltip "Yêu cầu Email").
     - `⚡` (ThunderboltOutlined + Tooltip "Văn bản mẫu / gõ phím tắt").
   - **Tích hợp Autocomplete Phím tắt `/`:** Khi Sale gõ `/` vào ô nhập liệu, tự động pop-up danh sách gợi ý `ZaloQuickReply`. Chọn mẫu là chèn ngay vào khung gõ.
4. **Cột 4: CRM Right Profile Panel (2 Tab Chuẩn Mực):**
   - **Tab 1: `Thông tin`**
     - Nút lớn **`⭐ Đánh dấu Khách VIP`** (Bật/tắt nhanh).
     - **Quản lý Nhãn (`Tags`):** Hiển thị các tag đang gắn + Nút `+ Quản lý` để thêm/tạo tag mới ngay trong lúc chat.
     - **Nhân viên phụ trách (`assigned_to`):** Dropdown chọn Sale để bàn giao hội thoại Zalo.
     - **Thông tin liên hệ phát hiện:** Hiển thị rõ SĐT, Email, Địa chỉ và nút **"⚡ Điền nhanh vào Khách hàng CRM"**.
   - **Tab 2: `Ghi chú nội bộ`**
     - Danh sách các ghi chú của ca trước / sếp để lại (kèm tên người tạo, thời gian).
     - Ô nhập ghi chú mới + nút "Thêm ghi chú" (`POST /{id}/notes/`).

---

## 🛠️ PHẦN 3: KẾ HOẠCH THỰC THI TỪNG BƯỚC (STEP-BY-STEP EXECUTION)

- **Bước 1 (Backend Migrations & API):** Viết model `ZaloLeadTag`, `ZaloLeadNote`, `ZaloQuickReply`, `is_starred`, tạo và chạy migration trong Docker `crm_web`. Cập nhật `serializers.py` và `views.py`.
- **Bước 2 (Frontend State & UI Structure):** Cập nhật `ZaloInboxPage.jsx` với thanh lọc dọc bên trái và cột phải 2 Tab (`Thông tin` & `Ghi chú nội bộ`).
- **Bước 3 (Thanh Công Cụ Chat & Phím Tắt `/`):** Nâng cấp ô nhập liệu Zalo với thanh 3 icon gọn phía trên và modal `ZaloQuickReply`.
- **Bước 4 (Đóng gói & Kiểm thử):** Chạy kiểm thử tự động/thủ công, đóng gói dữ liệu và push code lên GitHub.

---

## ⚠️ Quy tắc Bắt Buộc Cần Tuân Thủ
- **Chế độ Bảo trì (`AGENTS.md` Rule 1):** Bất kỳ form/modal nào thêm/sửa Tag, Ghi chú, hay đổi Sale trên Zalo Inbox đều phải kiểm tra `if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì...'); return; }`.
- **Code-First Configuration (`AGENTS.md` Rule 2):** Các quyền Zalo mới hoặc cấu hình mặc định phải khai báo cứng trong lệnh seed/config.
