#!/bin/bash
# CRM SaaS - Auto Backup to GitHub & Google Drive
# 
# Cách cài đặt tự động chạy hàng ngày:
# 1. Gõ lệnh: crontab -e
# 2. Thêm dòng sau vào cuối file (để chạy lúc 2h sáng):
#    0 2 * * * /bin/bash /root/crm-saas/auto_backup.sh >> /root/crm_backup.log 2>&1

# ================= CẤU HÌNH =================
BACKUP_BRANCH="fujitech"          # Tên nhánh GitHub chứa dữ liệu backup
DRIVE_REMOTE_NAME="gdrive"        # Tên remote Rclone (mặc định: gdrive)
DRIVE_BACKUP_FOLDER="CRM_Backups" # Tên thư mục trên Google Drive
PROJECT_DIR="/root/crm-saas"
TEMP_MEDIA_DIR="/tmp/crm_media_backup"
DATE=$(date +"%Y%m%d_%H%M%S")
# ============================================

echo "==================================================="
echo "🚀 BẮT ĐẦU SAO LƯU TỰ ĐỘNG - $DATE"
echo "==================================================="

cd $PROJECT_DIR || exit 1

# 1. Đồng bộ Dữ liệu (Database -> JSON) và đẩy lên GitHub
echo "=> Đang trích xuất Database ra file sync_data.json..."
# Chạy dumpdata trong container
docker exec -i crm_web python manage.py dumpdata -e contenttypes -e auth.Permission -e sessions -e admin.logentry --indent 2 -o sync_data.json

# Cấu hình an toàn cho Git (trường hợp chạy qua cron)
git config --global --add safe.directory $PROJECT_DIR

echo "=> Đang đẩy Code và Database lên nhánh Github: $BACKUP_BRANCH ..."
# Tạm thời chuyển sang nhánh backup, commit, push, rồi quay lại main
CURRENT_BRANCH=$(git branch --show-current)

# Chuyển sang nhánh backup (tạo nếu chưa có)
git checkout -B $BACKUP_BRANCH

# Commit sự thay đổi của sync_data.json và code (nếu có)
git add .
git commit -m "Auto Backup: Dữ liệu ngày $DATE"

# Push lên Github
git push origin $BACKUP_BRANCH

# Trở lại nhánh cũ để hệ thống tiếp tục chạy bình thường
git checkout $CURRENT_BRANCH

echo "✅ Đã sao lưu Code & Database lên GitHub ($BACKUP_BRANCH) thành công!"


# 2. Đóng gói Hình ảnh & Tài liệu (Media)
echo "=> Đang nén thư mục Media..."
mkdir -p $TEMP_MEDIA_DIR
MEDIA_TAR_FILE="$TEMP_MEDIA_DIR/media_$DATE.tar.gz"
tar -czf "$MEDIA_TAR_FILE" backend/media/

# 3. Đẩy file Media lên Google Drive bằng Rclone
echo "=> Đang tải file lên Google Drive ($DRIVE_REMOTE_NAME)..."
if command -v rclone &> /dev/null; then
    rclone copy "$MEDIA_TAR_FILE" "$DRIVE_REMOTE_NAME:$DRIVE_BACKUP_FOLDER/"
    if [ $? -eq 0 ]; then
        echo "✅ Tải lên Google Drive thành công!"
        
        # Tùy chọn: Xóa các file backup cũ trên Google Drive (quá 30 ngày)
        # rclone delete "$DRIVE_REMOTE_NAME:$DRIVE_BACKUP_FOLDER/" --min-age 30d
        
        # Xóa file nén tạm ở VPS cho nhẹ máy
        rm "$MEDIA_TAR_FILE"
    else
        echo "❌ Lỗi: Không thể tải lên Google Drive. Hãy kiểm tra lại cấu hình rclone."
    fi
else
    echo "⚠️ Rclone chưa được cài đặt, bỏ qua bước tải lên Google Drive."
    echo "File nén vẫn được giữ lại tại: $MEDIA_TAR_FILE"
fi

echo "==================================================="
echo "🎉 HOÀN TẤT SAO LƯU TỰ ĐỘNG - $(date +"%Y%m%d_%H%M%S")"
echo "==================================================="
