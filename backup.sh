#!/bin/bash
# CRM SaaS - Backup Script
# Script nay dung de sao luu toan bo Database va hinh anh/tai lieu tai len.

BACKUP_DIR="/root/crm_backups"
DATE=$(date +"%Y%m%d_%H%M%S")

echo "==================================================="
echo "BAT DAU SAO LUU DU LIEU CRM SAAS - $DATE"
echo "==================================================="

# Tao thu muc chua backup neu chua co
mkdir -p $BACKUP_DIR
cd /root/crm-saas || cd $(pwd)

# 1. Backup Database (PostgreSQL) tu Docker container
echo "=> Dang sao luu Database..."
docker exec -t crm_db pg_dump -U postgres -d crm_db -F c > "$BACKUP_DIR/database_$DATE.dump"

# 2. Backup thu muc Media (anh, file upload)
echo "=> Dang sao luu thu muc Media (Tai lieu tai len)..."
tar -czf "$BACKUP_DIR/media_$DATE.tar.gz" backend/media/

# 3. Nen toan bo lai thanh 1 file duy nhat
echo "=> Dang dong goi file Backup..."
cd $BACKUP_DIR
tar -czf "crm_full_backup_$DATE.tar.gz" "database_$DATE.dump" "media_$DATE.tar.gz"
rm "database_$DATE.dump" "media_$DATE.tar.gz"

# 4. Xoa cac ban backup cu (chi giu lai 7 ngay gan nhat)
echo "=> Dang don dep cac ban sao luu cu (giu lai 7 ngay)..."
find $BACKUP_DIR -name "crm_full_backup_*.tar.gz" -type f -mtime +7 -delete

echo "==================================================="
echo "✅ SAO LUU THANH CONG!"
echo "File sao luu duoc luu tai: $BACKUP_DIR/crm_full_backup_$DATE.tar.gz"
echo "Ban co the dung MobaXterm keo file nay ve may tinh ca nhan de cat giu."
echo "==================================================="
