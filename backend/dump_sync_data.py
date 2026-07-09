"""
Script: dump_sync_data.py
Đóng gói (xuất) toàn bộ dữ liệu ra file sync_data.json chuẩn UTF-8.
Sử dụng script này thay vì dùng toán tử `>` của PowerShell để tránh triệt để lỗi font chữ!
Chạy: docker exec crm_web python dump_sync_data.py
"""
import os
import sys
import django
import json
import codecs

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, '/app')
django.setup()

from django.core.management import call_command
from io import StringIO

print("=" * 60)
print("📦 Đang đóng gói dữ liệu hệ thống...")
print("=" * 60)

# Chạy lệnh dumpdata và bắt kết quả
out = StringIO()
# Có thể loại trừ (-e) các bảng không cần thiết nếu muốn
call_command(
    'dumpdata', 
    natural_foreign=True, 
    natural_primary=True,
    exclude=['contenttypes', 'auth.Permission', 'sessions.session'],
    stdout=out
)

json_data = out.getvalue()

try:
    # Format lại JSON cho đẹp và dễ đọc (indent=2)
    parsed_json = json.loads(json_data)
    
    # Ghi ra file với chuẩn mã hóa UTF-8 (đảm bảo 100% không bao giờ lỗi font tiếng Việt)
    sync_file = '/app/sync_data.json'
    with codecs.open(sync_file, 'w', encoding='utf-8') as f:
        json.dump(parsed_json, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Đã đóng gói thành công {len(parsed_json)} bản ghi vào file 'sync_data.json'!")
    print("✨ Dữ liệu được bảo vệ chuẩn UTF-8, không còn lo lỗi font chữ khi chuyển máy!")
except Exception as e:
    print(f"❌ Có lỗi xảy ra trong quá trình ghi file: {e}")

print("=" * 60)
