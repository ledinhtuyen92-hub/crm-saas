import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'crm_saas.settings')
django.setup()

from ai_agents.models import SystemAiKey
gemini_key = SystemAiKey.objects.filter(provider='gemini').first()
if gemini_key:
    from google import genai
    client = genai.Client(api_key=gemini_key.api_key)
    for m in client.models.list():
        if 'flash' in m.name:
            print(m.name)
