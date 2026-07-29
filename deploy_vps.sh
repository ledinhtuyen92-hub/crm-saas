#!/bin/bash
# CRM SaaS - Auto Deploy Script for Ubuntu VPS (22.04/24.04)
# Make sure to run this script as root! (sudo bash deploy_vps.sh)
#
# ⚠️⚠️⚠️  CẢNH BÁO QUAN TRỌNG  ⚠️⚠️⚠️
# Script này CHỈ dùng cho lần CÀI ĐẶT ĐẦU TIÊN trên VPS TRỐNG.
# Script này sẽ XÓA SẠCH TOÀN BỘ DỮ LIỆU database hiện tại (lệnh flush).
# ĐỂ CẬP NHẬT code mới lên VPS đang chạy, hãy dùng: sudo bash update_vps.sh
# ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️

echo "=========================================================="
echo "      🚀 KHOI TAO HE THONG CRM SAAS (ONE-CLICK) 🚀"
echo "=========================================================="

# 1. Kiem tra quyen root
if [ "$EUID" -ne 0 ]; then
  echo "Vui long chay script voi quyen root (sudo bash deploy_vps.sh)"
  exit
fi

# 2. Tao SWAP 4GB tranh loi sập server (Dành cho VPS yếu)
if [ ! -f /swapfile ]; then
    echo "=> Đang tạo 4GB RAM ảo (SWAP) để đảm bảo hệ thống mượt mà..."
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
else
    echo "=> SWAP đã tồn tại, bỏ qua bước tạo RAM ảo."
fi

# 3. Cập nhật và Cài đặt các gói cần thiết
echo "=> Cập nhật hệ thống và cài đặt công cụ cơ bản..."
apt-get update -y
apt-get install -y curl wget git nginx certbot python3-certbot-nginx

# Cài Docker nếu chưa có (phiên bản mới đã bao gồm docker compose plugin)
if ! command -v docker &> /dev/null; then
    echo "=> Đang cài đặt Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
fi

# Cài Node.js 20.x để build Frontend
if ! command -v node &> /dev/null; then
    echo "=> Đang cài đặt Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 4. Lấy Tên miền và cấu hình API URL
echo "=========================================================="
read -p "Nhập Tên miền của bạn (Vd: crm.congty.com). Nếu chưa trỏ IP thì nhập IP của VPS: " DOMAIN

if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    PROTOCOL="http"
else
    PROTOCOL="https"
fi

echo "VITE_API_URL=$PROTOCOL://$DOMAIN/api/" > frontend/.env.production

# Cấp quyền cho Nginx đọc thư mục root
chmod 711 /root
chmod -R 755 $(pwd)/frontend/dist

# Tự động nhận diện lệnh docker compose phù hợp với mọi đời Ubuntu
if command -v docker-compose &> /dev/null; then
    DOCKER_CMD="docker-compose"
else
    DOCKER_CMD="docker compose"
fi

# 5. Khởi động Backend bằng Docker
echo "=> Đang khởi chạy Backend (Django, Redis, Postgres, Celery)..."
mkdir -p backend/postgres_data
$DOCKER_CMD up -d --build

# Chờ Database sẵn sàng và nạp dữ liệu
echo "=> Đang đợi Database khởi động (10s)..."
sleep 10
echo "=> Cập nhật Database & Nạp dữ liệu mặc định..."
docker exec -i crm_web python manage.py migrate
docker exec -i crm_web python load_sync_data.py

# 6. Build Frontend
echo "=> Đang biên dịch giao diện Frontend (ReactJS)..."
cd frontend
npm install
npm run build
cd ..

# 7. Cấu hình Nginx
echo "=> Đang cấu hình Nginx Web Server..."
cat > /etc/nginx/sites-available/crm <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Phục vụ file tĩnh của React
    location / {
        root $(pwd)/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Chuyển hướng các request API về Django Backend (Docker port 8000)
    location ~ ^/(api|admin|media|static)/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

# 8. Cài đặt SSL (HTTPS)
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "=> Bạn đang dùng IP ($DOMAIN), bỏ qua cài đặt SSL."
else
    echo "=> Đang cài đặt chứng chỉ bảo mật SSL (HTTPS) cho tên miền $DOMAIN..."
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN
fi

echo "=========================================================="
echo "🎉 XIN CHÚC MỪNG! HỆ THỐNG ĐÃ CÀI ĐẶT THÀNH CÔNG!"
echo "Truy cập hệ thống tại: $PROTOCOL://$DOMAIN"
echo "Tài khoản quản trị mặc định đã được khôi phục từ sync_data.json"
echo "=========================================================="
