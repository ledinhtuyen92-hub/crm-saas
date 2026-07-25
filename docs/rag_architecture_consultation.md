# Kiến trúc Huấn luyện Trợ lý AI Doanh nghiệp (RAG Architecture)

Để xây dựng một Trợ lý AI **thực sự thông minh, có thể thay thế nhân viên chăm sóc khách hàng và sale**, việc chỉ sử dụng "Prompt" (Định hình tính cách) là chưa đủ. Các mô hình ngôn ngữ lớn (LLM) như GPT-4, Claude 3 tuy rất thông minh, nhưng chúng lại "mù tịt" về dữ liệu nội bộ của công ty anh (như bảng giá, chính sách bảo hành, kịch bản chốt sale riêng, thông tin sản phẩm đặc thù).

Đó là lý do chúng ta cần đến **RAG (Retrieval-Augmented Generation)** - công nghệ lõi đang được tất cả các tập đoàn lớn sử dụng để "dạy" AI.

---

## 1. Bản chất của RAG khác gì với Fine-tuning?

Nhiều người lầm tưởng "dạy AI" là phải **Fine-tuning** (huấn luyện lại trọng số của mô hình). Nhưng thực tế:
- **Fine-tuning:** Giống như dạy AI "cách nói chuyện" (giọng điệu, cấu trúc câu). Rất tốn kém, khó cập nhật dữ liệu mới (ví dụ đổi bảng giá là phải huấn luyện lại từ đầu), và AI dễ bị "ảo giác" (bịa ra thông tin).
- **RAG:** Giống như phát cho AI một **cuốn bách khoa toàn thư mở**. Khi khách hỏi, hệ thống sẽ "lật sách" tìm đúng trang có chứa câu trả lời, sau đó bảo AI: *"Dựa vào đoạn tài liệu này, hãy trả lời khách bằng giọng điệu thân thiện"*. 
> [!IMPORTANT]
> **RAG là tiêu chuẩn bắt buộc** cho AI Doanh nghiệp vì: **Chính xác tuyệt đối (ít bịa chuyện) - Dễ dàng cập nhật/Xóa bỏ tài liệu - Tiết kiệm chi phí cực lớn.**

---

## 2. Luồng hoạt động chuẩn chỉ của Hệ thống RAG trong CRM

Để làm chức năng **Quản lý Tài liệu Huấn luyện**, hệ thống CRM của anh cần xây dựng một "Đường ống dữ liệu" (Data Pipeline) gồm 5 bước:

### Bước 1: Thu thập Dữ liệu (Ingestion)
Giao diện tải tài liệu phải hỗ trợ nhiều định dạng:
- **Tài liệu tĩnh:** PDF, Word (docx), Excel, TXT.
- **QA (Hỏi - Đáp):** Dạng form nhập liệu trực tiếp (ví dụ: *Hỏi: Công ty có freeship không? / Đáp: Đơn trên 5 triệu thì freeship*). Cực kỳ quan trọng để dạy AI các mẹo xử lý từ chối của Sale.
- **Dữ liệu động:** Đồng bộ từ chính Database của CRM (ví dụ: Tự động cho AI học toàn bộ Sản phẩm trong kho, Báo giá).

### Bước 2: Băm nhỏ Dữ liệu (Chunking)
AI không thể đọc 1 lúc cuốn sách 1000 trang. Backend sẽ tự động chia nhỏ file PDF/Word của anh thành các đoạn văn ngắn (khoảng 300 - 500 từ/đoạn). 
*Lưu ý kỹ thuật:* Cần áp dụng "Semantic Chunking" (chia theo ý nghĩa câu) để tránh việc một câu bị cắt làm đôi khiến AI không hiểu.

### Bước 3: Mã hóa thành Số (Embedding)
Hệ thống gọi API của OpenAI (hoặc mô hình mã hóa riêng biệt như `text-embedding-3-small`) để biến các đoạn văn (text) thành **Vector** (ma trận số). Lúc này, AI sẽ hiểu ý nghĩa của đoạn văn dựa trên khoảng cách của các con số.

### Bước 4: Lưu trữ vào Vector Database
Các vector này không thể lưu bằng MySQL hay PostgreSQL thông thường một cách hiệu quả. Chúng ta có 2 phương án:
1. **Dùng Plugin pgvector:** Cài thêm plugin cho PostgreSQL hiện tại (Tiết kiệm chi phí, dễ quản lý vì chung 1 database).
2. **Dùng Vector DB chuyên dụng (SaaS):** Pinecone, Qdrant (Tốc độ truy xuất siêu nhanh cho hệ thống khổng lồ).
*(Đề xuất: Sử dụng `pgvector` cho giai đoạn đầu để tối ưu chi phí).*

### Bước 5: Truy xuất và Trả lời (Retrieval & Generation)
1. Khách nhắn tin Zalo/Facebook: *"Tủ bếp Acrylic giá sao em?"*
2. Hệ thống CRM biến câu hỏi này thành Vector.
3. So sánh Vector câu hỏi với Vector DB để lấy ra 3 đoạn tài liệu có "ý nghĩa" gần giống nhất (ví dụ: lấy ra đoạn mô tả giá tủ bếp Acrylic trong file Excel).
4. CRM ghép câu hỏi + 3 đoạn tài liệu đó nhét vào Prompt gửi cho LLM.
5. AI đọc tài liệu và sinh ra câu trả lời xuất sắc gửi lại cho khách.

---

## 3. Các module cần xây dựng cho chức năng này

Để triển khai, em sẽ cần xây dựng các giao diện và chức năng sau:

1. **Giao diện Quản lý Tri thức (Knowledge Base):**
   - Danh sách các tài liệu đã tải lên (Tên, Định dạng, Trạng thái: *Đang học / Đã học xong / Lỗi*).
   - Nút **[+ Thêm tài liệu mới]** (Hỗ trợ kéo thả PDF, Word).
2. **Giao diện Quản lý QA (Cặp Câu hỏi - Trả lời):**
   - Giúp Giám đốc/Quản lý Sale tự tay nhập các kịch bản sale xuất sắc vào hệ thống. AI sẽ ưu tiên lấy dữ liệu ở mục này trước.
3. **Cấu hình Trợ lý & Gắn Tri thức:**
   - Khi tạo 1 con AI (ví dụ: AI Chăm sóc Khách hàng), anh có thể tích chọn cho phép con AI này "Đọc" những tài liệu nào. (AI CSKH thì chỉ đọc chính sách, AI Kỹ thuật thì đọc tài liệu HDSD).
4. **Backend Worker:** 
   - Tiến trình chạy ngầm (Background Task) dùng Celery/Redis để xử lý file PDF nặng mà không làm đơ trang web.

> [!TIP]
> **Giải pháp nâng cao cho Tương lai (Advanced RAG):**
> Sau này, để AI khôn như người thật, hệ thống cần tích hợp thêm **Hybrid Search** (Tìm kiếm theo vector kết hợp tìm kiếm từ khóa chính xác) và **Reranking** (Chấm điểm lại tài liệu trước khi đưa cho AI đọc) để độ chính xác lên tới 99%.
