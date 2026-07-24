import json
import logging
from django.conf import settings
from .models import SystemAiKey, CompanyAiSettings, AiAgent

# Import AI Providers
from openai import OpenAI
from google import genai as google_genai
from google.genai import types as genai_types
import anthropic

logger = logging.getLogger(__name__)

def get_provider_for_model(model_name: str) -> str:
    if not model_name:
        return 'openai'
    if 'gpt' in model_name.lower():
        return 'openai'
    elif 'gemini' in model_name.lower():
        return 'gemini'
    elif 'claude' in model_name.lower():
        return 'anthropic'
    return 'openai'

def get_api_keys(company, provider: str) -> list:
    """
    Trả về danh sách các API Key theo thứ tự ưu tiên.
    - Bước 1: Lấy toàn bộ CompanyAiKey đang is_active=True của provider đó, sắp xếp theo priority giảm dần.
    - Bước 2: Nếu CompanyAiSettings.use_system_keys đang là True, lấy thêm danh sách Key hệ thống ghép vào sau.
    """
    keys = []
    
    # 1. Lấy danh sách Key cá nhân của công ty
    from .models import CompanyAiKey
    company_keys = CompanyAiKey.objects.filter(
        company=company, 
        provider=provider, 
        is_active=True
    ).order_by('-priority', '-created_at')
    
    for ck in company_keys:
        if ck.api_key and ck.api_key.strip():
            keys.append(ck.api_key.strip())
            
    # 2. Kiểm tra xem công ty có dùng Quota dự phòng không
    try:
        company_settings = CompanyAiSettings.objects.get(company=company)
        use_system_keys = company_settings.use_system_keys
    except CompanyAiSettings.DoesNotExist:
        use_system_keys = False
        
    if use_system_keys:
        system_keys = SystemAiKey.objects.filter(is_active=True, provider=provider).order_by('-priority')
        for sk in system_keys:
            if sk.api_key and sk.api_key.strip():
                keys.append(sk.api_key.strip())
                
    return keys

def call_openai(api_key, agent, system_prompt, conversation_history):
    client = OpenAI(api_key=api_key)
    messages = [{'role': 'system', 'content': system_prompt}]
    for msg in conversation_history[-10:]:
        messages.append({'role': msg['role'], 'content': msg['content']})

    response = client.chat.completions.create(
        model=agent.model_name or 'gpt-4o-mini',
        messages=messages,
        temperature=agent.temperature,
        response_format={ "type": "json_object" }
    )
    return json.loads(response.choices[0].message.content)

def call_gemini(api_key, agent, system_prompt, conversation_history):
    client = google_genai.Client(api_key=api_key)
    
    # Build contents from conversation history  
    contents = []
    for msg in conversation_history[-10:]:
        role = 'model' if msg['role'] == 'assistant' else 'user'
        contents.append(genai_types.Content(role=role, parts=[genai_types.Part(text=msg['content'])]))
    
    model_name = agent.model_name or 'gemini-2.5-flash'
    # Remove 'models/' prefix if present
    if model_name.startswith('models/'):
        model_name = model_name[7:]
    
    response = client.models.generate_content(
        model=model_name,
        contents=contents,
        config=genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=agent.temperature,
            response_mime_type='application/json',
        )
    )
    return json.loads(response.text)

def call_anthropic(api_key, agent, system_prompt, conversation_history):
    client = anthropic.Anthropic(api_key=api_key)
    messages = []
    for msg in conversation_history[-10:]:
        # Anthropic uses 'user' and 'assistant' ONLY
        messages.append({'role': msg['role'], 'content': msg['content']})

    response = client.messages.create(
        model=agent.model_name or 'claude-3-5-sonnet-20240620',
        max_tokens=1024,
        temperature=agent.temperature,
        system=system_prompt,
        messages=messages
    )
    text_content = response.content[0].text
    if "```json" in text_content:
        text_content = text_content.split("```json")[1].split("```")[0]
    return json.loads(text_content.strip())

def generate_ai_reply(agent: AiAgent, conversation_history: list, lead_name: str):
    provider = get_provider_for_model(agent.model_name)
    api_keys = get_api_keys(agent.company, provider)
    
    if not api_keys:
        logger.warning(f"No API Key configured for provider {provider}")
        return {'reply': 'Hệ thống AI chưa được cấu hình API Key.', 'sentiment': 'neutral', 'summary': ''}

    default_json_template = """{
    "thought": "Phân tích tâm lý khách hàng và lên chiến thuật trả lời (Suy nghĩ nháp trước khi chat)",
    "reply": "Câu trả lời gửi khách. Nếu KHÔNG BIẾT/không chắc chắn, xin phép đợi nhân viên kiểm tra.",
    "sentiment": "angry / handoff / neutral (BẮT BUỘC chọn 'handoff' nếu bạn không biết, thiếu dữ liệu, phải nhờ người khác kiểm tra, báo khách đợi, hoặc khách đòi gặp Sale. Chọn 'angry' nếu khách chửi bậy/đe dọa. Còn lại chọn 'neutral')",
    "extracted_info": {
        "phone": "Trích xuất SĐT nếu có (nếu không có thì để rỗng)",
        "address": "Trích xuất địa chỉ nếu có (nếu không có thì để rỗng)",
        "notes": "Ghi chú (size, màu sắc...)"
    },
    "tags": ["Hỏi giá", "Khách VIP", "Đã chốt"...],
    "summary": "Tóm tắt ngắn gọn lịch sử chat"
}"""
    
    json_template = agent.core_prompt_template.strip() if agent.core_prompt_template else default_json_template

    system_prompt = f"""Bạn là {agent.name}. {agent.system_prompt}
Bạn đang chat với khách hàng tên là {lead_name}.
Nhiệm vụ của bạn là tư vấn và hỗ trợ khách hàng.
TRẢ LỜI BẮT BUỘC THEO ĐỊNH DẠNG JSON SAU (không trả về Markdown, chỉ JSON thô):
{json_template}"""

    last_error = None
    for api_key in api_keys:
        try:
            if provider == 'openai':
                return call_openai(api_key, agent, system_prompt, conversation_history)
            elif provider == 'gemini':
                return call_gemini(api_key, agent, system_prompt, conversation_history)
            elif provider == 'anthropic':
                return call_anthropic(api_key, agent, system_prompt, conversation_history)
        except Exception as e:
            logger.error(f"{provider.upper()} API Key Error (Key: {api_key[:8]}...): {str(e)}")
            last_error = str(e)
            continue
            
    logger.error(f"All {provider} keys failed. Last error: {last_error}")
    return {'reply': 'Xin lỗi, hệ thống AI đang quá tải.', 'sentiment': 'neutral', 'summary': ''}
