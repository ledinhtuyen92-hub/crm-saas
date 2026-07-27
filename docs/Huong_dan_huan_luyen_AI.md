# BÍ KÍP HUẤN LUYỆN TRỢ LÝ AI (RAG) CHUẨN NHẤT

Để Trợ lý AI của bạn trở nên thông minh, phản xạ nhanh và tư vấn chính xác như một nhân viên Sale/CSKH xuất sắc, việc chuẩn bị tài liệu "dạy" (Training Data) là yếu tố quan trọng số 1. Dưới đây là hướng dẫn chi tiết để bạn chuẩn bị dữ liệu chuẩn nhất.

---

## ⚠️ LƯU Ý QUAN TRỌNG NHẤT: ĐỒNG NHẤT NỀN TẢNG ĐỌC (EMBEDDING MODEL)
Hệ thống sử dụng các nền tảng đọc (OpenAI, Google Gemini) để "biến chữ thành số" giúp AI tìm kiếm. Bạn **BẮT BUỘC** phải lưu ý nguyên tắc sau:
- **Chỉ sử dụng 1 nền tảng duy nhất:** Không được hôm nay dùng OpenAI để học tài liệu A, ngày mai lại đổi sang Gemini để học tài liệu B. 
- **Lý do:** Các nền tảng nói các "ngôn ngữ số" khác nhau. Nếu bạn dùng OpenAI để chat, AI sẽ **không thể** đọc hiểu và tìm kiếm được các tài liệu đã học bằng Gemini (và ngược lại).
- **Cách xử lý:** Hãy chốt 1 nền tảng ngay từ đầu (Khuyến nghị: OpenAI vì tốc độ siêu nhanh và rẻ). Hãy đảm bảo **tất cả** các tài liệu trong kho đều hiển thị cùng một loại "Nền tảng đọc". Nếu lỡ đổi nền tảng, bạn cần bấm nút **Học lại** (biểu tượng xoay vòng) hoặc Xóa đi tải lại để đồng bộ hóa.

---

## 1. NÊN TẢI LÊN NHỮNG TÀI LIỆU GÌ?
Sắp xếp theo độ hiệu quả giúp AI thông minh nhất từ cao xuống thấp:

### 🥇 Dạng 1: Hỏi & Đáp (Q&A) thực tế - (Độ hiệu quả: Cao nhất)
Đây là cách AI học nhanh và "khôn" nhất vì nó mô phỏng chính xác đoạn hội thoại.
- **Cách làm:** Sử dụng nút "Nhập trực tiếp Hỏi - Đáp" trên phần mềm.
- **Nội dung:** Các câu hỏi thường gặp (FAQ), những tình huống từ chối của khách kèm theo câu trả lời chuẩn mực nhất của công ty.
- *Ví dụ:* 
  - **Hỏi:** Hàng này bảo hành sao em?
  - **Đáp:** Dạ bên em bảo hành chính hãng 2 năm, 1 đổi 1 trong 30 ngày đầu nếu có lỗi phần cứng từ nhà sản xuất ạ.

### 🥈 Dạng 2: Thông số sản phẩm & Bảng giá
- **Nội dung:** File Word/PDF chứa Bảng báo giá chi tiết, Tính năng (Specs), Phân loại của từng dòng sản phẩm.
- **Cách làm:** Nên trình bày theo dạng Bảng biểu (Table) hoặc Gạch đầu dòng rõ ràng để AI dễ dàng bóc tách thông tin.

### 🥉 Dạng 3: Chính sách & Quy trình kinh doanh
- **Nội dung:** Chính sách bảo hành, đổi trả, quy định giao hàng, thông tin thanh toán (Số tài khoản), thời gian làm việc, địa chỉ cửa hàng.
- **Mục đích:** Giúp AI không bao giờ tư vấn sai luật hay cung cấp nhầm thông tin chuyển khoản cho khách hàng.

### 🏅 Dạng 4: Kịch bản chốt Sale (Sales Script)
- **Nội dung:** Các kịch bản xin số điện thoại, kịch bản chốt deal, tư vấn up-sell. Trợ lý AI sẽ ngầm học được "giọng điệu" (Tone & Voice) khéo léo của công ty từ các file này.

---

## 2. BA "BÍ KÍP VÀNG" KHI SOẠN THẢO TÀI LIỆU
Để AI không bị "loạn", hãy tuân thủ 3 quy tắc vàng sau:

1. **KHÔNG dùng file toàn hình ảnh:** AI đọc chữ (Text) rất giỏi, nhưng nó không nhìn được chữ nằm bên trong tấm ảnh chụp (trừ khi có tính năng OCR). Hãy đảm bảo file PDF/Word của bạn là dạng **chữ có thể bôi đen và copy được**.
2. **CHIA NHỎ tốt hơn Gộp chung:** Thay vì đẩy 1 file PDF dài 500 trang chứa "hầm bà lằng" mọi thứ, hãy tách ra thành các file chuyên đề nhỏ gọn như: `Bang_gia_2026.pdf`, `Chinh_sach_bao_hanh.pdf`, `Quy_dinh_doi_tra.pdf`. Điều này giúp AI truy xuất cực kỳ chính xác.
3. **CẤU TRÚC rõ ràng:** Hãy dùng Tiêu đề lớn (Heading), Tiêu đề nhỏ, Gạch đầu dòng để phân chia đoạn văn. Một tài liệu rành mạch, gọn gàng sẽ tạo ra một AI thông minh, rành mạch.

---
*Chúc bạn đào tạo được một Trợ lý AI xuất sắc, giúp X10 doanh số và tối ưu thời gian chăm sóc khách hàng!*
