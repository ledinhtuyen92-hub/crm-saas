#!/bin/bash
# CRM SaaS - Script tự động cài đặt Rclone
# Cách chạy: bash setup_rclone.sh

echo "==================================================="
echo "🚀 BẮT ĐẦU CÀI ĐẶT RCLONE (KẾT NỐI GOOGLE DRIVE)"
echo "==================================================="

# 1. Cài đặt Rclone
echo "=> Đang tải và cài đặt Rclone..."
sudo -v ; curl -s https://rclone.org/install.sh | sudo bash

echo ""
echo "✅ Đã cài đặt Rclone thành công!"
echo "==================================================="

# 2. Kiểm tra cấu hình cũ
CONFIG_DIR="$HOME/.config/rclone"
CONFIG_FILE="$CONFIG_DIR/rclone.conf"

if [ -f "$CONFIG_FILE" ]; then
    echo "🎉 TUYỆT VỜI! Đã tìm thấy file cấu hình rclone.conf cũ tại VPS này."
    echo "Bạn KHÔNG CẦN phải làm gì thêm. Hệ thống sẽ tự kết nối Drive!"
else
    echo "⚠️ HƯỚNG DẪN BƯỚC TIẾP THEO (XÁC THỰC GOOGLE DRIVE)"
    echo "Hiện tại VPS chưa được kết nối với tài khoản Google Drive nào."
    echo ""
    echo "Nếu đây là VPS mới và bạn có lưu file rclone.conf từ VPS cũ:"
    echo "👉 Hãy copy file rclone.conf đó ném vào đường dẫn: $CONFIG_FILE"
    echo ""
    echo "Nếu đây là lần cài đặt đầu tiên, bạn hãy gõ lệnh sau để kết nối:"
    echo "👉 Lệnh: rclone config"
    echo ""
    echo "Và trả lời các câu hỏi như sau:"
    echo "- name> gdrive"
    echo "- Storage> 18 (Google Drive)"
    echo "- client_id> (Ấn Enter)"
    echo "- client_secret> (Ấn Enter)"
    echo "- scope> 1"
    echo "- service_account_file> (Ấn Enter)"
    echo "- Edit advanced config?> n"
    echo "- Use auto config?> n (RẤT QUAN TRỌNG: CHỌN NO)"
    echo ""
    echo "Sau đó làm theo màn hình để copy mã Token từ máy tính dán vào VPS nhé!"
fi
echo "==================================================="
