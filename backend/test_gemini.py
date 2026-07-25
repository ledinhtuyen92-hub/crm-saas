import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from rest_framework import serializers
try:
    raise serializers.ValidationError({'model_name': 'API Key expired'})
except serializers.ValidationError as e:
    print(e.detail)
