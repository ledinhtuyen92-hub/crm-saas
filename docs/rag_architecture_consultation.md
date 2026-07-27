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

## 3. Các module cốt lõi đã được xây dựng thành công

Hệ thống hiện tại đã hoàn thiện toàn bộ các module cốt lõi của một hệ thống RAG tiêu chuẩn:

1. **Giao diện Quản lý Tri thức (Knowledge Base):**
   - Quản lý tập trung tài liệu, trạng thái học thời gian thực, có bộ lọc thông minh theo Trợ lý, Trạng thái, và Nền tảng đọc.
2. **Hỗ trợ Đa định dạng (Multi-format):**
   - Đọc hiểu mượt mà các định dạng PDF, Word và nhập liệu trực tiếp dạng Hỏi & Đáp (Q&A).
3. **Cấu hình Trợ lý & Gắn Tri thức:**
   - Mỗi Trợ lý AI đều có "Tính cách" (System Prompt) riêng biệt và được chỉ định đọc những tài liệu cụ thể.
4. **Backend Worker xử lý ngầm:** 
   - Sử dụng Celery để băm nhỏ (Chunking) và Vector hóa (Embedding) tài liệu dưới nền, không bao giờ làm đơ giật trang web.

---

## 4. Các tính năng Nâng cao (Advanced AI Features) đang sở hữu

Được thiết kế theo chuẩn Enterprise, hệ thống của chúng ta đã vượt ra khỏi giới hạn của một Chatbot thông thường:

### 🚀 Công nghệ lõi RAG Kép (Dual-Engine RAG)
Tách biệt hoàn toàn 2 "bộ não" để tối ưu hiệu năng:
- **Bộ não Tìm kiếm (Embedding Engine):** Hỗ trợ công nghệ nhúng của cả **OpenAI (1536 chiều)** và **Google Gemini (768 chiều)**. Áp dụng kỹ thuật nén Vector tiên tiến (MRL) giúp AI tìm kiếm siêu tốc trong hàng ngàn trang tài liệu.
- **Bộ não Giao tiếp (Generative LLM):** Hỗ trợ linh hoạt các mô hình ngôn ngữ lớn như `GPT-4o`, `GPT-3.5-Turbo`, `Gemini 1.5 Pro` để viết ra các đoạn chat tự nhiên nhất.

### 🌐 Xử lý Đa kênh Thông minh (Omnichannel AI)
- Tự động "trực" 24/7 trên các kênh: **Zalo ZOA** và **Facebook Messenger**.
- **Cơ chế chờ tin nhắn thông minh (Debounce Delay):** AI biết cách "chờ đợi" khi khách hàng gõ từng dòng lắt nhắt, sau đó gom tất cả lại để trả lời mượt mà trong 1 tin nhắn duy nhất, tránh tình trạng spam.

### 🙋‍♂️ Cơ chế Ủy quyền cho Người thật (Human-in-the-loop)
- **Công tắc AI linh hoạt:** Khi nhân viên Sales nhảy vào tư vấn thủ công, họ có thể tắt ngay công tắc AI của khách đó đi. Hệ thống sẽ lập tức im lặng nhường quyền cho người thật. AI không bao giờ "tranh cướp" khách của nhân viên.

### 🛠 Cơ chế Auto-Healing & Sửa lỗi Tự động
- Bắt và dịch toàn bộ các lỗi từ Google/OpenAI sang tiếng Việt (Sai API Key, Hết tiền quota, Máy chủ quá tải).
- **Cơ chế "Học Lại" tự động dọn dẹp:** Khi người dùng chuyển đổi nền tảng đọc và ấn Học lại, hệ thống sẽ tự động quét, xóa sạch toàn bộ Vector rác cũ và băm lại từ đầu theo đúng chuẩn mới để bảo vệ Database.

> [!TIP]
> **Giải pháp nâng cao cho Tương lai (Advanced RAG):**
> Sau này, để AI khôn như người thật, hệ thống cần tích hợp thêm **Hybrid Search** (Tìm kiếm theo vector kết hợp tìm kiếm từ khóa chính xác) và **Reranking** (Chấm điểm lại tài liệu trước khi đưa cho AI đọc) để độ chính xác lên tới 99%.
