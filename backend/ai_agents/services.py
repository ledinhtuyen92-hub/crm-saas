import json
import logging
from openai import OpenAI
from django.conf import settings
from .models import SystemAiKey, CompanyAiSettings, AiAgent

logger = logging.getLogger(__name__)

def get_api_key(company):
    try:
        company_settings = CompanyAiSettings.objects.get(company=company)
        if company_settings.use_system_keys:
            system_key = SystemAiKey.objects.filter(is_active=True, provider='openai').order_by('-priority').first()
            return system_key.api_key if system_key else None
        return company_settings.custom_openai_key
    except CompanyAiSettings.DoesNotExist:
        system_key = SystemAiKey.objects.filter(is_active=True, provider='openai').order_by('-priority').first()
        return system_key.api_key if system_key else None

def generate_ai_reply(agent: AiAgent, conversation_history: list, lead_name: str):
    api_key = get_api_key(agent.company)
    if not api_key:
        return {'reply': 'Hệ thống AI chưa được cấu hình API Key.', 'sentiment': 'neutral', 'summary': ''}

    client = OpenAI(api_key=api_key)

    system_prompt = f"""Bạn là {agent.name}. {agent.system_prompt}
Bạn đang chat với khách hàng tên là {lead_name}.
Nhiệm vụ của bạn là tư vấn và hỗ trợ khách hàng.
TRẢ LỜI BẮT BUỘC THEO ĐỊNH DẠNG JSON SAU:
{{
    "reply": "Câu trả lời của bạn gửi cho khách hàng",
    "sentiment": "angry hoặc neutral (chọn angry nếu khách chửi bậy, tức giận, đe dọa)",
    "summary": "Tóm tắt ngắn gọn lịch sử chat đến hiện tại (1-2 câu)"
}}"""

    messages = [{'role': 'system', 'content': system_prompt}]
    for msg in conversation_history[-10:]:  # Lấy 10 tin gần nhất
        messages.append({'role': msg['role'], 'content': msg['content']})

    try:
        response = client.chat.completions.create(
            model=agent.model_name or 'gpt-4o-mini',
            messages=messages,
            temperature=agent.temperature,
            response_format={ "type": "json_object" }
        )
        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        logger.error(f'OpenAI Error: {str(e)}')
        return {'reply': 'Xin lỗi, hệ thống AI đang quá tải.', 'sentiment': 'neutral', 'summary': ''}
