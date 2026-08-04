# Hướng dẫn Kết nối Google Drive & Hẹn giờ Backup tự động

Script `auto_backup.sh` đã được cấu hình tự động đẩy Code + Dữ liệu (Database JSON) lên nhánh GitHub `fujitech` và nén file hình ảnh đưa lên Google Drive.
Dưới đây là các bước bạn cần làm **DUY NHẤT 1 LẦN** trên VPS để hệ thống kết nối với Google Drive và tự động chạy hàng ngày.

---

## BƯỚC 1: Cấp quyền chạy cho script
Tại thư mục gốc của dự án trên VPS, chạy lệnh cấp quyền thực thi cho nó:
```bash
chmod +x auto_backup.sh
```

---

## BƯỚC 2: Cài đặt Rclone trên VPS
Rclone là công cụ giúp VPS giao tiếp với Google Drive. Chạy lệnh sau để cài đặt:
```bash
sudo -v ; curl https://rclone.org/install.sh | sudo bash
```

---

## BƯỚC 3: Kết nối với Google Drive (Rất quan trọng)
Vì VPS không có trình duyệt web, bạn cần làm theo mẹo "xác thực từ xa" (headless) như sau:

1. Trên VPS, gõ lệnh:
   ```bash
   rclone config
   ```
2. Màn hình sẽ hiện ra các câu hỏi, trả lời lần lượt như sau:
   - Ấn `n` (New remote) -> Đặt tên là `gdrive` (viết liền không dấu, phải khớp cấu hình trong auto_backup.sh).
   - Chọn loại lưu trữ: Nhập số `18` (Hoặc số tương ứng với chữ **Google Drive** trong danh sách).
   - `client_id>` và `client_secret>`: Cứ ấn Enter bỏ qua.
   - `scope>`: Nhập số `1` (Full access).
   - `service_account_file>`: Ấn Enter bỏ qua.
   - Bỏ qua cấu hình nâng cao (`Edit advanced config?`): Ấn `n`.
   - **CÂU HỎI QUAN TRỌNG NHẤT (`Use auto config?`)**: Chọn `n` (No) vì VPS không có trình duyệt.

3. Lúc này, Rclone trên VPS sẽ hiện ra một dòng hướng dẫn (dạng `rclone authorize "drive" "eyJ..."`).
   - Bạn **KHÔNG THỂ** bấm trực tiếp link trên VPS.
   - Thay vào đó, tải Rclone về máy tính Windows cá nhân tại đây: https://rclone.org/downloads/
   - Giải nén ra, mở CMD/PowerShell tại thư mục giải nén.
   - Copy cái lệnh `rclone authorize...` mà VPS vừa cho, dán vào CMD của máy tính Windows rồi ấn Enter.
   - Lập tức trình duyệt web trên máy tính sẽ tự bật lên, hãy đăng nhập tài khoản Google và bấm "Cho phép".
   - Sau đó, quay lại màn hình CMD của Windows, nó sẽ nhả ra một đoạn mã RẤT DÀI (token). Hãy bôi đen copy đoạn mã đó.
   - Quay lại màn hình VPS, dán đoạn mã token đó vào và ấn Enter là XONG!

---

## BƯỚC 4: Hẹn giờ chạy tự động mỗi ngày (Cron job)
Cuối cùng, đặt lịch để VPS tự động chạy script này lúc 2h00 sáng mỗi đêm.

1. Trên VPS, gõ lệnh:
   ```bash
   crontab -e
   ```
   *(Nếu được hỏi chọn editor, ấn phím `1` để chọn nano).*

2. Di chuyển con trỏ xuống dòng cuối cùng và dán lệnh sau vào:
   ```bash
   0 2 * * * /bin/bash /root/crmfujitech/auto_backup.sh >> /root/crm_backup.log 2>&1
   ```
3. Ấn `Ctrl + O` -> `Enter` để lưu, sau đó ấn `Ctrl + X` để thoát.

🎉 **XONG!** Kể từ đêm nay, đúng 2h sáng hệ thống sẽ tự nén Media đưa lên Drive và đẩy Database lên nhánh `fujitech` trên GitHub. Bạn có thể xem lại log ở file `/root/crm_backup.log`.
