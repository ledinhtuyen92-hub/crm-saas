# Kế hoạch Triển khai Nâng cấp Facebook Multi-Page Inbox: Thu thập Đa thông tin Khách hàng (SĐT, Email, Địa chỉ) & Cấu hình Động Mẫu Xin Thông Tin

> **Tài liệu Kế hoạch Kỹ thuật Chuẩn mực cho AI/Phát triển viên thực thi kế tiếp**  
> **Dự án:** CRM SaaS (Django + React/Vite)  
> **Ngày lập:** 15/07/2026  

---

## 🎯 Tổng quan & Mục tiêu Dự án

Hiện tại, hệ thống CRM SaaS đã có khả năng:
- Bóc tách SĐT tự động trong tin nhắn qua `smart_extract_vn_phone`.
- Gửi tin nhắn xin SĐT khi bấm nút "Yêu cầu chia sẻ SĐT" (với mẫu câu hardcode cứng trong `views.py`).

**Mục tiêu của Kế hoạch Nâng cấp này:**
1. **Giai đoạn 1 (Tùy chỉnh Mẫu xin số & Quick Reply 1 chạm):** Cho phép Quản lý/Shop tự thay đổi lời nhắn xin SĐT, Email trên giao diện Web mà không cần sửa code. Gửi tin nhắn kèm Nút bấm 1 chạm (`user_phone_number`, `user_email`) theo chuẩn Graph API.
2. **Giai đoạn 2 (Bộ quét AI/Regex Email & Địa chỉ tự động):** Mở rộng thuật toán Smart Scanner để quét tự động SĐT + Email + Địa chỉ trong tin nhắn chat, tự động điền vào hồ sơ Khách hàng và hiển thị huy hiệu báo hiệu trên UI.
3. **Giai đoạn 3 (Tích hợp Facebook Lead Ads Webhook):** Nhận dữ liệu tự động từ các chiến dịch quảng cáo biểu mẫu (Lead Form) của Meta và tạo khách hàng ngay lập tức.

---

## 🏗️ PHẦN 1: GIAI ĐOẠN 1 — CẤU HÌNH ĐỘNG MẪU XIN SĐT/EMAIL & QUICK REPLY 1 CHẠM

### 1.1. Mục tiêu Kỹ thuật
- Thay thế câu text cố định *"Dạ chào bạn, để tiện hỗ trợ..."* trong `backend/facebook_integration/views.py` bằng cấu hình động lưu trong `FacebookPageConfig`.
- Gửi payload Graph API hỗ trợ `quick_replies` với `content_type: user_phone_number` và `content_type: user_email`.

### 1.2. Thay đổi Backend (`backend/facebook_integration`)
1. **Cập nhật Model (`models.py` & `facebook_integration/models.py`):**
   - Thêm 2 trường mới vào model `FacebookPageConfig`:
     ```python
     request_phone_template = models.TextField(
         default="Dạ chào bạn, để tiện chuyên viên tư vấn chi tiết và gửi bảng giá ưu đãi, bạn cho mình xin số điện thoại liên hệ với ạ ❤️",
         verbose_name="Mẫu tin nhắn xin SĐT"
     )
     request_email_template = models.TextField(
         default="Dạ bạn cho mình xin địa chỉ Email để bên em gửi catalogue và thông tin chi tiết qua email cho mình nhé 📧",
         verbose_name="Mẫu tin nhắn xin Email"
     )
     ```
   - Chạy lệnh migration:
     ```bash
     docker exec crm_web python manage.py makemigrations facebook_integration
     docker exec crm_web python manage.py migrate
     ```

2. **Cập nhật Serializers (`serializers.py` & `facebook_integration/serializers.py`):**
   - Thêm `request_phone_template` và `request_email_template` vào `FacebookPageConfigSerializer`.

3. **Cập nhật Logic Gửi tin nhắn (`services.py` & `facebook_integration/services.py`):**
   - Trong hàm `send_facebook_message(...)`, thêm tham số `quick_replies: list = None`.
   - Nếu có `quick_replies`, bổ sung vào payload Graph API:
     ```python
     if quick_replies:
         payload["message"]["quick_replies"] = quick_replies
     ```

4. **Cập nhật View Gửi tin nhắn (`views.py` & `facebook_integration/views.py` - Action `send_message` in `FacebookLeadViewSet`):**
   - Nhận thêm tham số `request_email = request.data.get("request_email") in ["true", "True", True, 1, "1"]`.
   - Khi `request_phone == True`:
     - Lấy câu text từ `config.request_phone_template`.
     - Tạo payload quick replies: `quick_replies = [{"content_type": "user_phone_number"}]`.
   - Khi `request_email == True`:
     - Lấy câu text từ `config.request_email_template`.
     - Tạo payload quick replies: `quick_replies = [{"content_type": "user_email"}]`.
   - Khi `request_phone == True` và `request_email == True`:
     - Kết hợp cả 2 nút quick replies và mẫu tin nhắn.

### 1.3. Thay đổi Frontend (`frontend/src/pages/FacebookInboxPage.jsx`)
1. **Thanh công cụ chat (Chat Toolbar):**
   - Bên cạnh nút `Yêu cầu chia sẻ SĐT`, bổ sung thêm nút **`📧 Yêu cầu Email`** (gọi `handleSend(null, false, true)`).
   - Nút `Yêu cầu chia sẻ SĐT` sẽ gọi `handleSend(null, true, false)`.

2. **Giao diện Cấu hình Trang Facebook (trong Modal/Page Quản lý kết nối Facebook):**
   - Thêm 2 ô `Input.TextArea` trong form chỉnh sửa `FacebookPageConfig`:
     - *Lời nhắn xin SĐT (Mặc định)*
     - *Lời nhắn xin Email (Mặc định)*
   - Khi bấm "Lưu cấu hình", gọi PUT/PATCH tới `/api/facebook/pages/{id}/` để lưu 2 trường template.

---

## 🏗️ PHẦN 2: GIAI ĐOẠN 2 — BỘ QUÉT AI/REGEX EMAIL & ĐỊA CHỈ TỰ ĐỘNG (SMART SCANNER)

### 2.1. Mục tiêu Kỹ thuật
- Tự động phát hiện SĐT, Email, và Địa chỉ ngay khi nhận tin nhắn từ khách (Webhook) hoặc khi đồng bộ lịch sử hội thoại.
- Lưu trữ vào DB và tự động đồng bộ vào trường `phone`, `email`, `address` của `Customer`.

### 2.2. Thay đổi Backend (`backend/facebook_integration`)
1. **Cập nhật Model (`models.py` & `facebook_integration/models.py`):**
   - Thêm các trường phát hiện tự động vào `FacebookLead`:
     ```python
     detected_email = models.EmailField(max_length=255, blank=True, null=True, verbose_name="Email tự động quét")
     detected_address = models.CharField(max_length=500, blank=True, null=True, verbose_name="Địa chỉ tự động quét")
     ```
   - Chạy migration.

2. **Cập nhật Thuật toán Quét thông minh (`services.py` & `facebook_integration/services.py`):**
   - Thêm hàm `smart_extract_email(text: str) -> str`:
     ```python
     def smart_extract_email(text: str):
         if not text:
             return None
         pattern_email = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b')
         match = pattern_email.search(text)
         return match.group(0).lower() if match else None
     ```
   - Thêm hàm `smart_extract_address(text: str) -> str`:
     ```python
     def smart_extract_address(text: str):
         if not text:
             return None
         # Quét nhận diện các từ khóa đặc trưng của địa chỉ Việt Nam
         address_keywords = ['số nhà', 'sn', 'đường', 'phố', 'phường', 'xã', 'quận', 'huyện', 'tỉnh', 'tp', 'thành phố', 'kđt', 'chung cư', 'tòa', 'ngõ', 'hẻm']
         text_lower = text.lower()
         if any(kw in text_lower for kw in address_keywords):
             # Lấy cả câu hoặc đoạn có chứa từ khóa địa chỉ (tối thiểu 15 ký tự)
             lines = text.split('\n')
             for line in lines:
                 if any(kw in line.lower() for kw in address_keywords) and len(line.strip()) >= 12:
                     return line.strip()
         return None
     ```
   - Cập nhật hàm `extract_and_process_phone_fb(lead, text: str)` thành `extract_and_process_contact_info_fb(lead, text: str)`:
     - Quét `smart_extract_vn_phone(text)` -> lưu vào `lead.detected_phone`.
     - Quét `smart_extract_email(text)` -> lưu vào `lead.detected_email`.
     - Quét `smart_extract_address(text)` -> lưu vào `lead.detected_address`.
     - Nếu `lead.customer` đã liên kết:
       - Tự động cập nhật `customer.phone`, `customer.email`, `customer.address` nếu các trường này ở customer đang bị trống (`None` hoặc `""`).
     - Lưu lại các update fields của `FacebookLead` và `Customer`.

### 2.3. Thay đổi Frontend (`FacebookInboxPage.jsx`)
1. **Danh sách hội thoại (`ConvItem`):**
   - Hiển thị các Tag/Huy hiệu thông tin nhận diện dưới tên khách hàng:
     - `📞 {lead.detected_phone}` (màu xanh lá)
     - `📧 {lead.detected_email}` (màu xanh dương)
     - `🏠 {lead.detected_address}` (màu cam, cắt ngắn nếu dài quá 25 ký tự)
2. **Cột phải CRM Profile Panel (`Tab Thông tin`):**
   - Hiển thị rõ ràng 3 trường: SĐT phát hiện, Email phát hiện, Địa chỉ phát hiện.
   - Thêm nút **"⚡ Điền nhanh vào Khách hàng CRM"** nếu hồ sơ Customer CRM đang thiếu Email hoặc Địa chỉ này.

---

## 🏗️ PHẦN 3: GIAI ĐOẠN 3 — TÍCH HỢP FACEBOOK LEAD ADS WEBHOOK (`leadgen`)

### 3.1. Mục tiêu Kỹ thuật
- Nhận Webhook `leadgen` khi có khách hàng hoàn thành Form quảng cáo của Meta.
- Tự động tải chi tiết Form từ Graph API `/LEAD_ID` và tạo hồ sơ Khách hàng CRM mới đầy đủ 100% thông tin ngay lập tức.

### 3.2. Thay đổi Backend (`backend/facebook_integration`)
1. **Xử lý Webhook (`services.py` & `views.py`):**
   - Trong endpoint `webhook()` (`POST /api/facebook/webhook/`), kiểm tra event type:
     ```python
     for entry in body.get("entry", []):
         for change in entry.get("changes", []):
             if change.get("field") == "leadgen":
                 value = change.get("value", {})
                 lead_id = value.get("leadgen_id")
                 page_id = value.get("page_id")
                 process_facebook_leadgen(page_id, lead_id)
     ```

2. **Hàm bóc tách Lead Form (`process_facebook_leadgen` trong `services.py`):**
   - Gọi Graph API: `GET https://graph.facebook.com/v25.0/{lead_id}?access_token={page_access_token}`
   - Dữ liệu trả về có cấu trúc `field_data`:
     ```json
     "field_data": [
         {"name": "full_name", "values": ["Nguyễn Văn A"]},
         {"name": "phone_number", "values": ["+84912345678"]},
         {"name": "email", "values": ["nguyenvana@gmail.com"]},
         {"name": "city", "values": ["Hà Nội"]},
         {"name": "street_address", "values": ["Số 10 Đường Trần Phú"]}
     ]
     ```
   - Chuẩn hóa SĐT với `normalize_phone()`.
   - Tạo mới `Customer` trong DB:
     - `name`: `full_name`
     - `phone`: `phone_number` (đã chuẩn hóa)
     - `email`: `email`
     - `address`: `street_address` + `, ` + `city`
     - `source`: `"facebook_lead_ads"`
     - `status`: `"new"`
   - Thực hiện chia hội thoại/Khách hàng cho Sale theo cơ chế Round-Robin hoặc gán cho Quản lý mặc định.

---

## 📝 Quy tắc Chấp hành Mã nguồn (Checklist cho AI phát triển)

- [ ] **Quy tắc 1: Code-First & Đồng bộ `facebook_integration`**: Bất kỳ sửa đổi nào trong `models.py`, `serializers.py`, `views.py`, `services.py` của `backend/facebook_integration` **BẮT BUỘC** phải sao chép y nguyên sang thư mục duplicate `backend/facebook_integration/facebook_integration/...`.
- [ ] **Quy tắc 2: Chế độ bảo trì (`AGENTS.md`)**: Khi phát triển Frontend (`FacebookInboxPage.jsx` hoặc trang Cấu hình), bất kỳ thao tác lưu/cập nhật mẫu xin số nào phải kiểm tra `if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì...'); return; }`.
- [ ] **Quy tắc 3: Docker Execution**: Các lệnh migration và test luôn chạy bên trong container:
  ```bash
  docker exec crm_web python manage.py makemigrations facebook_integration
  docker exec crm_web python manage.py migrate
  ```

---
*Tài liệu này đã được lưu sẵn trong source code dự án (`KE_HOACH_FACEBOOK_CONTACT_SCANNER.md`). AI tiếp nhận yêu cầu tiếp theo chỉ cần đọc file này và bắt đầu lập trình theo từng bước.*
