#!/bin/bash
# CRM SaaS - Script tu dong cai dat Rclone
# Cach chay: bash setup_rclone.sh

echo "==================================================="
echo "🚀 BAT DAU CAI DAT RCLONE (KET NOI GOOGLE DRIVE)"
echo "==================================================="

# 1. Cai dat Rclone
echo "=> Dang tai va cai dat Rclone..."
sudo -v ; curl -s https://rclone.org/install.sh | sudo bash

echo ""
echo "✅ Da cai dat Rclone thanh cong!"
echo "==================================================="

# 2. Kiem tra cau hinh cu
CONFIG_DIR="$HOME/.config/rclone"
CONFIG_FILE="$CONFIG_DIR/rclone.conf"

if [ -f "$CONFIG_FILE" ]; then
    echo "🎉 TUYET VOI! Da tim thay file cau hinh rclone.conf cu tai VPS nay."
    echo "Ban KHONG CAN phai lam gi them. He thong se tu ket noi Drive!"
else
    echo "⚠ HUONG DAN BUOC TIEP THEO (XAC THUC GOOGLE DRIVE)"
    echo "Hien tai VPS chua duoc ket noi voi tai khoan Google Drive nao."
    echo ""
    echo "Neu day la VPS moi va ban co luu file rclone.conf tu VPS cu:"
    echo "👉 Hay copy file rclone.conf do nem vao duong dan: $CONFIG_FILE"
    echo ""
    echo "Neu day la lan cai dat dau tien, ban hay go lenh sau de ket noi:"
    echo "👉 Lenh: rclone config"
    echo ""
    echo "Va tra loi cac cau hoi nhu sau:"
    echo "- name> gdrive"
    echo "- Storage> 18 (Google Drive)"
    echo "- client_id> (An Enter)"
    echo "- client_secret> (An Enter)"
    echo "- scope> 1"
    echo "- service_account_file> (An Enter)"
    echo "- Edit advanced config?> n"
    echo "- Use auto config?> n (RAT QUAN TRONG: CHON NO)"
    echo ""
    echo "Sau do lam theo man hinh de copy ma Token tu may tinh dan vao VPS nhe!"
fi
echo "==================================================="
