#!/bin/bash
# CRM SaaS - Script CẬP NHẬT code mới lên VPS (chạy khi đã có hệ thống rồi)
#
# ✅ Cách dùng (mỗi lần cần update):
#    cd /duong-dan-du-an   (vào thư mục dự án)
#    sudo bash update_vps.sh
#
# ℹ️  Script này đã tự động git pull bên trong, KHÔNG cần chạy git pull thủ công trước.
# ℹ️  Lần đầu tiên: cần git pull 1 lần để tải file này về VPS, sau đó KHÔNG cần nữa.
# Chạy trên VPS, KHÔNG phải máy tính local.

set -e  # Dừng ngay nếu có lỗi

echo "=========================================================="
echo "      🔄 CẬP NHẬT CRM SAAS LÊN PHIÊN BẢN MỚI NHẤT 🔄"
echo "=========================================================="

# 1. Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then
  echo "⚠️  Vui lòng chạy script với quyền root: sudo bash update_vps.sh"
  exit 1
fi

# 2. Lấy code mới nhất từ GitHub
echo ""
echo "📥 [1/5] Đang kéo code mới nhất từ GitHub (nhánh main)..."
git pull origin main
echo "✅ Code đã được cập nhật thành công!"

# 3. Chạy migrate nếu có thay đổi DB schema
echo ""
echo "🗄️  [2/5] Kiểm tra và cập nhật cấu trúc Database..."
docker exec -i crm_web python manage.py migrate --no-input
echo "✅ Database đã được migrate!"

# 4. Nạp lại quyền hệ thống (seed_permissions)
echo ""
echo "🔐 [3/5] Đang nạp lại danh sách quyền hệ thống..."
docker exec -i crm_web python manage.py seed_permissions
echo "✅ Permissions đã được cập nhật!"

# 5. Build lại Frontend
echo ""
echo "⚛️  [4/5] Đang biên dịch lại giao diện React (Frontend)..."
cd frontend
npm install --prefer-offline
npm run build
cd ..
echo "✅ Frontend đã được build xong!"

# 6. Reload Nginx để phục vụ file mới nhất
echo ""
echo "🌐 [5/5] Đang reload Nginx để áp dụng giao diện mới..."
systemctl reload nginx
echo "✅ Nginx đã được reload!"

echo ""
echo "=========================================================="
echo "🎉 CẬP NHẬT HOÀN TẤT! Hệ thống đã chạy phiên bản mới."
echo ""
echo "   📝 Lưu ý: Backend Django tự động nhận code mới"
echo "      do volume mount ./backend:/app trong docker-compose."
echo "      KHÔNG cần restart Docker container."
echo "=========================================================="
