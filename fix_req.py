import sys

with open('backend/requirements.txt', 'rb') as f:
    content = f.read()

# Replace utf-16 null bytes if they exist
content = content.replace(b'\x00', b'')

with open('backend/requirements.txt', 'wb') as f:
    f.write(content)
print("Fixed requirements.txt encoding")