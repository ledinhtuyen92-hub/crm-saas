#!/bin/bash
# CRM SaaS - Backup Script
# Script này dùng để sao lưu toàn bộ Database và hình ảnh/tài liệu tải lên.

BACKUP_DIR="/root/crm_backups"
DATE=$(date +"%Y%m%d_%H%M%S")

echo "==================================================="
echo "BẮT ĐẦU SAO LƯU DỮ LIỆU CRM SAAS - $DATE"
echo "==================================================="

# Tạo thư mục chứa backup nếu chưa có
mkdir -p $BACKUP_DIR
cd /root/crm-saas || cd $(pwd)

# 1. Backup Database (PostgreSQL) từ Docker container
echo "=> Đang sao lưu Database..."
docker exec -t crm_db pg_dump -U postgres -d crm_db -F c > "$BACKUP_DIR/database_$DATE.dump"

# 2. Backup thư mục Media (ảnh, file upload)
echo "=> Đang sao lưu thư mục Media (Tài liệu tải lên)..."
tar -czf "$BACKUP_DIR/media_$DATE.tar.gz" backend/media/

# 3. Nén toàn bộ lại thành 1 file duy nhất
echo "=> Đang đóng gói file Backup..."
cd $BACKUP_DIR
tar -czf "crm_full_backup_$DATE.tar.gz" "database_$DATE.dump" "media_$DATE.tar.gz"
rm "database_$DATE.dump" "media_$DATE.tar.gz"

# 4. Xóa các bản backup cũ (chỉ giữ lại 7 ngày gần nhất)
echo "=> Đang dọn dẹp các bản sao lưu cũ (giữ lại 7 ngày)..."
find $BACKUP_DIR -name "crm_full_backup_*.tar.gz" -type f -mtime +7 -delete

echo "==================================================="
echo "✅ SAO LƯU THÀNH CÔNG!"
echo "File sao lưu được lưu tại: $BACKUP_DIR/crm_full_backup_$DATE.tar.gz"
echo "Bạn có thể dùng MobaXterm kéo file này về máy tính cá nhân để cất giữ."
echo "==================================================="
