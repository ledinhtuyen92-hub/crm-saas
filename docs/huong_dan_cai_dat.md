# HƯỚNG DẪN CÀI ĐẶT HỆ THỐNG CRM SAAS LÊN VPS (ONE-CLICK)

Tài liệu này hướng dẫn cách đưa toàn bộ hệ thống lên môi trường thực tế (VPS Server) một cách tự động và dễ dàng nhất dành cho người không chuyên.

---

## BƯỚC 1: CHUẨN BỊ MÁY CHỦ (VPS)
Bạn cần thuê 1 máy chủ ảo (VPS) từ các nhà cung cấp như BizflyCloud, Vietnix, DigitalOcean...
- **Hệ điều hành:** Ubuntu 22.04 LTS hoặc 24.04 LTS.
- **Cấu hình tối thiểu:** 2 Cores CPU, 2GB - 4GB RAM (Khuyến nghị 4GB).
- Mở Terminal/CMD/MobaXterm trên máy tính và đăng nhập vào VPS bằng tài khoản `root`.

## BƯỚC 2: TẢI SOURCE CODE VỀ VPS
Chạy lệnh sau trên VPS để tải mã nguồn dự án về:

```bash
git clone https://github.com/ledinhtuyen92-hub/crm-saas.git && cd crm-saas
```
*(Nếu kho Github của bạn là private, hệ thống sẽ yêu cầu nhập Username và Password/Token Github).*

## BƯỚC 3: KÍCH HOẠT CÀI ĐẶT TỰ ĐỘNG
Trong thư mục dự án, chạy duy nhất 1 lệnh sau:

```bash
sudo bash deploy_vps.sh
```

**Kịch bản cài đặt tự động sẽ bắt đầu chạy:**
1. Nó tự động cài Ram Ảo (Swap 4GB) để chống sập server cho bạn.
2. Tự động cập nhật hệ điều hành và cài Docker, Nginx, Node.js.
3. Chạy lên và hỏi bạn: *"Nhập Tên miền của bạn (Vd: crm.congty.com). Nếu chưa có thì nhập IP của VPS: "*
4. Bạn gõ Tên miền hoặc IP vào rồi bấm `Enter`.
5. Việc còn lại phần mềm tự động build giao diện, tự động nạp Database mẫu (`sync_data.json`), tự động xin chứng chỉ ổ khóa xanh SSL (nếu bạn nhập tên miền).

Tất cả diễn ra hoàn toàn tự động, cuối cùng màn hình sẽ báo dòng chữ:
🎉 **XIN CHÚC MỪNG! HỆ THỐNG ĐÃ CÀI ĐẶT THÀNH CÔNG!**

---
**LƯU Ý:**
- Mật khẩu và tài khoản quản trị mặc định đã được khôi phục nguyên vẹn từ tệp `sync_data.json`.

---

## BƯỚC 4: CÁCH CẬP NHẬT PHIÊN BẢN MỚI
Sau này khi bạn lập trình thêm tính năng mới trên máy tính (VS Code) và muốn đưa lên VPS, hãy làm theo quy trình chuẩn sau:

**1. Đẩy code lên Github (Làm trên VS Code máy tính):**
Bấm vào mục Source Control trong VS Code hoặc dùng lệnh:
```bash
git add .
git commit -m "Thêm tính năng XYZ"
git push origin main
```

**2. Kéo code và Cập nhật trên Server (Làm trên VPS):**
Đăng nhập vào VPS bằng MobaXterm, di chuyển vào thư mục dự án và gõ 3 lệnh sau:
```bash
cd ~/crm-saas
git pull
sudo bash deploy_vps.sh
```
*(Kịch bản sẽ tự động quét và chỉ build/cập nhật những phần code mới thay đổi cực kỳ nhanh chóng mà không làm gián đoạn hệ thống hiện tại).*
