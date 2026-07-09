"""
Script: load_sync_data.py
Xóa toàn bộ dữ liệu cũ và nạp lại từ sync_data.json (hỗ trợ UTF-16)
Chạy: docker exec crm_web python load_sync_data.py
"""
import os
import sys
import json
import codecs
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, '/app')
django.setup()

from django.core.management import call_command
from django.db import connection, transaction
from io import StringIO

print("=" * 60)
print("🗑️  Bước 1: Xóa toàn bộ dữ liệu cũ (flush)...")
print("=" * 60)

call_command('flush', '--no-input', verbosity=0)
print("✅ Đã xóa sạch dữ liệu cũ!")

print()
print("=" * 60)
print("📖 Bước 2: Đọc file sync_data.json (UTF-16)...")
print("=" * 60)

sync_file = '/app/sync_data.json'
try:
    with codecs.open(sync_file, 'r', encoding='utf-16') as f:
        raw = f.read()
    print(f"✅ Đọc file thành công ({len(raw)} ký tự)")
except (UnicodeDecodeError, UnicodeError):
    print("⚠️  UTF-16 thất bại, thử UTF-8...")
    with open(sync_file, 'r', encoding='utf-8') as f:
        raw = f.read()
    print(f"✅ Đọc file UTF-8 thành công ({len(raw)} ký tự)")

# Parse và thống kê
data = json.loads(raw)
model_counts = {}
for item in data:
    m = item.get('model', 'unknown')
    model_counts[m] = model_counts.get(m, 0) + 1

print(f"\n📊 Tổng cộng {len(data)} bản ghi:")
for model, count in sorted(model_counts.items()):
    print(f"   {model}: {count}")

print()
print("=" * 60)
print("📥 Bước 3: Nạp dữ liệu vào database...")
print("=" * 60)

# Ghi ra file tạm với encoding UTF-8 để Django loaddata có thể đọc
tmp_file = '/tmp/sync_data_utf8.json'
with open(tmp_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"✅ Đã chuyển đổi sang UTF-8: {tmp_file}")

try:
    call_command('loaddata', tmp_file, verbosity=2)
    print()
    print("=" * 60)
    print("🎉 HOÀN TẤT! Dữ liệu từ sync_data.json đã được nạp thành công!")
    print("=" * 60)
except Exception as e:
    print(f"\n❌ Lỗi khi loaddata: {e}")
    import traceback
    traceback.print_exc()
finally:
    if os.path.exists(tmp_file):
        os.remove(tmp_file)
