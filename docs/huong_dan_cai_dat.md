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
git clone https://github.com/ledinhtuyen92-hub/crmfujitech.git && cd crmfujitech
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
cd ~/crmfujitech
git pull
sudo bash deploy_vps.sh
```
*(Kịch bản sẽ tự động quét và chỉ build/cập nhật những phần code mới thay đổi cực kỳ nhanh chóng mà không làm gián đoạn hệ thống hiện tại).*

---

## BƯỚC 5: SAO LƯU DỮ LIỆU (CHỐNG HACK/MẤT DỮ LIỆU)

Để hệ thống luôn an toàn tuyệt đối 100%, bạn nên kết hợp 2 phương án sao lưu sau:

**1. Phương án Vàng: Bật tính năng Auto Backup của nhà cung cấp VPS**
- Cách an toàn nhất chống lại Hacker/Ransomware là bạn lên trang quản trị của Bizfly hoặc Vultr, bật tính năng **"Auto Backup" (hoặc Snapshot)**. 
- Tính năng này tốn thêm vài chục nghìn/tháng nhưng nó sẽ chụp ảnh (snapshot) toàn bộ máy chủ mỗi ngày. Nếu bị hack hoặc xóa nhầm, bạn chỉ cần bấm 1 nút là thời gian quay ngược lại y hệt ngày hôm qua.

**2. Phương án Chủ động: Chạy file Backup bằng tay**
Hệ thống đã có sẵn một công cụ sao lưu dữ liệu siêu tốc. Trên màn hình MobaXterm, bạn chỉ cần chạy lệnh:
```bash
sudo bash backup.sh
```
- Lệnh này sẽ tự động đóng gói toàn bộ Database khách hàng và Hình ảnh tải lên thành 1 tệp tin nén duy nhất nằm ở thư mục `/root/crm_backups/`.
- Sau đó, ở cột bên trái của phần mềm MobaXterm (mục SFTP), bạn mở thư mục đó ra và **kéo file nén thả về máy tính cá nhân** để cất vào ổ cứng hoặc đẩy lên Google Drive. Rất an toàn và đơn giản!

**3. Phương án Nâng cao: Tự động đồng bộ lên Google Drive mỗi đêm**
Nếu bạn muốn hệ thống tự động backup và đẩy lên Google Drive lúc 2h sáng mỗi ngày mà không cần thao tác tay, hãy cài đặt Rclone:

**Bước 3.1: Cài đặt Rclone**
Gõ lệnh sau vào VPS:
```bash
sudo -v ; curl https://rclone.org/install.sh | sudo bash
```

**Bước 3.2: Kết nối Google Drive**
Gõ lệnh `rclone config`
- Bấm `n` (New remote) -> Đặt tên là `gdrive`.
- Chọn loại lưu trữ là Google Drive (thường là số `18`).
- Cứ nhấn Enter để bỏ qua các mục không quan trọng cho đến khi nó đưa cho bạn 1 đường link.
- Copy link đó dán vào trình duyệt, đăng nhập Gmail và bấm Cho phép (Allow).

**Bước 3.3: Lên lịch chạy tự động**
- Mở file backup.sh ra và thêm dòng lệnh rclone copy vào cuối file:
  `rclone copy /root/crm_backups gdrive:CRM_Backups`
- Gõ lệnh `crontab -e` trên VPS và dán dòng này vào cuối cùng để chạy tự động lúc 2h sáng:
  `0 2 * * * bash /root/crmfujitech/backup.sh`

---

## BƯỚC 6: XỬ LÝ CÁC LỖI THƯỜNG GẶP (TROUBLESHOOTING)

**1. Lỗi web hiện "500 Internal Server Error"**
- **Nguyên nhân:** Máy chủ Ubuntu bảo mật quá chặt, Nginx không có quyền đọc file giao diện cài đặt trong thư mục `/root/...`
- **Cách sửa:** Copy và dán lệnh sau vào màn hình VPS (để cấp quyền đọc cho Nginx):
  ```bash
  chmod 711 /root && chmod -R 755 /root/crmfujitech/frontend/dist
  ```

**2. Quá trình cài đặt tự động bị lỗi ở bước SSL (DNS problem: NXDOMAIN)**
- **Nguyên nhân:** Tên miền của bạn chưa được trỏ IP thành công, hoặc trỏ sai Name Server (rất hay gặp ở TenTen nếu chưa đổi NS về `ns-a1.tenten.vn`). Do đó Let's Encrypt từ chối cấp ổ khóa xanh.
- **Hậu quả:** Vào web sẽ bị báo "Không bảo mật" (Not Secure). Nghiêm trọng hơn, khi bạn cố gắng đăng nhập sẽ bị báo lỗi **"Không thể đăng nhập. Vui lòng kiểm tra lại thông tin"** (Do giao diện không thể gửi mật khẩu qua đường ống HTTPS bị hỏng).
- **Cách sửa:**
  1. Kiểm tra lại việc trỏ bản ghi A (hoặc Name Server) trên trang quản lý Tên miền.
  2. Chờ 15-60 phút để mạng Internet toàn cầu cập nhật.
  3. Mở trình duyệt gõ `http://tenmien.com` (không có chữ `s`). Nếu web đã tải được giao diện bình thường thì vào màn hình VPS gõ lại lệnh sau để ốp ổ khóa xanh vào:
  ```bash
  certbot --nginx -d crm.congty.com
  ```
  *(Nhớ thay crm.congty.com bằng tên miền thực tế của bạn).*
  **Lưu ý:** Nếu màn hình hiện ra câu hỏi *"What would you like to do?"*, bạn chỉ cần gõ số **`1`** (Attempt to reinstall this existing certificate) rồi nhấn **Enter** là xong.
