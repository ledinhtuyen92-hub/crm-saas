import sys
with open('docker-compose.yml', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("postgres_data:  celery:", "postgres_data:\n\n  celery:")
with open('docker-compose.yml', 'w', encoding='utf-8') as f:
    f.write(content)