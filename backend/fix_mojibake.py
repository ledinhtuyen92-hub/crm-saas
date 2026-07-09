import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.apps import apps
from django.db import models, transaction

def fix_string(s):
    if not isinstance(s, str) or not s:
        return s
    try:
        # Encode to cp437 (which was the mistaken decoding) and back to utf-8
        encoded = s.encode('cp437')
        decoded = encoded.decode('utf-8')
        # If it changed, return the decoded version
        if decoded != s:
            return decoded
    except Exception:
        pass
    return s

def run():
    print("Bắt đầu sửa lỗi font Mojibake trên toàn bộ Database...")
    fixed_count = 0
    with transaction.atomic():
        for model in apps.get_models():
            # Get all CharField and TextField
            text_fields = [f for f in model._meta.fields if isinstance(f, (models.CharField, models.TextField))]
            if not text_fields:
                continue
                
            try:
                for obj in model.objects.all():
                    changed = False
                    for field in text_fields:
                        val = getattr(obj, field.attname)
                        new_val = fix_string(val)
                        if new_val != val:
                            setattr(obj, field.attname, new_val)
                            changed = True
                            
                    if changed:
                        obj.save(update_fields=[f.attname for f in text_fields])
                        fixed_count += 1
                        print(f"✅ Đã sửa: {model.__name__} ID {obj.pk}")
            except Exception as e:
                # Some models might fail due to database views or abstract tables
                print(f"❌ Lỗi model {model.__name__}: {e}")

    print(f"🎉 Hoàn tất! Đã sửa lỗi font cho {fixed_count} bản ghi.")

if __name__ == '__main__':
    run()
