import threading
from django.utils import timezone
from .models import AiAgent
from .services import generate_ai_reply
from zalo_integration.models import SocialLead as ZaloLead, ZaloMessage
from facebook_integration.models import FacebookLead, FacebookMessage
from zalo_integration.services import send_zalo_chat_message
from facebook_integration.services import send_facebook_message
import logging
logger = logging.getLogger(__name__)
from celery import shared_task

def get_public_domain():
    import requests
    try:
        res = requests.get("http://host.docker.internal:4040/api/tunnels", timeout=2)
        if res.status_code == 200:
            tunnels = res.json().get('tunnels', [])
            if tunnels:
                return tunnels[0]['public_url'].rstrip('/')
    except Exception:
        pass
    
    # Fallback for production or if ngrok not found
    from django.conf import settings
    return getattr(settings, 'SITE_URL', 'http://localhost:8000').rstrip('/')

@shared_task(bind=True, max_retries=3)
def sync_product_image_vector(self, template_id):
    from inventory.models import ProductTemplate
    from ai_agents.image_recognition import get_image_embedding
    
    try:
        template = ProductTemplate.objects.get(id=template_id)
        if template.image:
            # We can use the file path or URL
            image_path = template.image.path
            vector = get_image_embedding(image_path_or_url=image_path)
            
            if vector:
                template.image_vector = vector
                template.save(update_fields=['image_vector'])
                return f"Synced vector for ProductTemplate {template_id}"
        return f"No image or vector failed for {template_id}"
    except Exception as e:
        self.retry(exc=e, countdown=10)

def search_products_for_carousel(company, keyword: str, limit: int = 3):
    from inventory.models import Product
    from django.db.models import Q
    
    if not keyword:
        return []
        
    products = Product.objects.filter(
        company=company,
        is_active=True
    ).filter(
        Q(name__icontains=keyword) | Q(template__description__icontains=keyword) | Q(sku__icontains=keyword)
    ).select_related('template')[:limit]
    
    results = []
    for p in products:
        if p.template and p.template.image:
            image_url = p.template.image.url
            if image_url.startswith('/'):
                image_url = f"{get_public_domain()}{image_url}"
                
            results.append({
                'title': p.name,
                'subtitle': f"Giá: {p.price:,.0f} VNĐ" if p.price else (p.template.description[:70] + "..." if p.template.description else p.name),
                'image_url': image_url,
                'sku': p.sku
            })
    return results




def process_ai_reply_zalo(lead_id, is_followup=False, trigger_msg_id=None):
    try:
        lead = ZaloLead.objects.get(id=lead_id)
        if not lead.oa_config or not lead.oa_config.is_ai_active or not lead.oa_config.ai_agent:
            return
        if not lead.is_ai_active and not is_followup:
            return
            
        if not is_followup:
            import time
            delay = lead.oa_config.ai_agent.debounce_delay
            time.sleep(delay)
            
        if not is_followup and trigger_msg_id:
            from zalo_integration.models import ZaloMessage
            latest_msg = ZaloMessage.objects.filter(social_lead=lead, direction=ZaloMessage.DIRECTION_INBOUND).order_by('-created_at').first()
            if latest_msg and latest_msg.id != trigger_msg_id:
                logger.info(f"Zalo AI debounce: Bỏ qua tin nhắn cũ {trigger_msg_id} do đã có tin mới {latest_msg.id}")
                return

        # Lấy lịch sử
        messages = ZaloMessage.objects.filter(social_lead=lead).order_by('-created_at')[:10]
        history = []
        visual_search_text = ""
        
        for m in reversed(messages):
            role = 'user' if m.direction == ZaloMessage.DIRECTION_INBOUND else 'assistant'
            history.append({'role': role, 'content': m.content or '([Hình ảnh/File đính kèm])'})
            
        # Thử nhận diện ảnh nếu tin nhắn cuối cùng là ảnh
        latest_msg = messages.first()
        if latest_msg and latest_msg.direction == ZaloMessage.DIRECTION_INBOUND and latest_msg.attachment_url:
            from ai_agents.image_recognition import get_image_embedding
            vector = get_image_embedding(image_path_or_url=latest_msg.attachment_url)
            if vector:
                from inventory.models import ProductTemplate
                from ai_agents.models import AiKnowledgeDocument
                from pgvector.django import CosineDistance
                
                visual_hints = []
                matched_product = ProductTemplate.objects.filter(
                    company=lead.company, 
                    image_vector__isnull=False
                ).annotate(distance=CosineDistance('image_vector', vector)).order_by('distance').first()
                
                if matched_product and getattr(matched_product, 'distance', 1) < 0.4:
                    visual_hints.append(f"- Sản phẩm tương tự nhất: {matched_product.name}")
                    
                matched_doc = AiKnowledgeDocument.objects.filter(
                    agent=lead.oa_config.ai_agent,
                    image_vector__isnull=False
                ).annotate(distance=CosineDistance('image_vector', vector)).order_by('distance').first()
                
                if matched_doc and getattr(matched_doc, 'distance', 1) < 0.4:
                    visual_hints.append(f"- Tài liệu/Hình ảnh tham khảo tương đồng:\n  + Tiêu đề: {matched_doc.title}\n  + Nội dung mô tả: {matched_doc.content}")
                
                if visual_hints:
                    visual_search_text = "\n\n[HỆ THỐNG GỢI Ý (VISUAL SEARCH)]:\nKhách hàng vừa gửi 1 bức ảnh. AI Vision đã quét và tìm thấy thông tin liên quan trong hệ thống:\n" + "\n".join(visual_hints) + "\nHãy dựa vào đây để tư vấn!"

        if is_followup:
            history.append({'role': 'system', 'content': 'Khách hàng đã không phản hồi hơn 24 giờ. Hãy viết một câu chào hỏi, gợi mở hoặc hỏi thăm khéo léo để tiếp tục câu chuyện một cách tự nhiên nhất.'})

        result = generate_ai_reply(lead.oa_config.ai_agent, history, lead.display_name + visual_search_text)
        if result.get('error'):
            lead.is_ai_active = False
            lead.has_unread_message = True  # Đánh dấu để Sale thấy và vào xử lý
            lead.save(update_fields=['is_ai_active', 'has_unread_message'])
            return
            
        ai_agent = lead.oa_config.ai_agent
        
        # 1. Trích xuất dữ liệu
        extracted = result.get('extracted_info', {})
        if isinstance(extracted, dict):
            phone = extracted.get('phone', '')
            if phone and isinstance(phone, str) and 'rỗng' not in phone.lower() and len(phone) > 8 and not lead.detected_phone:
                lead.detected_phone = phone
            address = extracted.get('address', '')
            if address and isinstance(address, str) and 'rỗng' not in address.lower() and len(address) > 5 and not lead.detected_address:
                lead.detected_address = address
                
        # 2. Gắn Tag
        if ai_agent.enable_auto_tagging:
            tags = result.get('tags', [])
            if isinstance(tags, list) and tags:
                clean_tags = [t.strip()[:50] for t in tags if isinstance(t, str) and t.strip()]
                if clean_tags:
                    lead.ai_tags = clean_tags
                        
        # 3. Tóm tắt hội thoại
        if ai_agent.enable_auto_summary:
            summary = result.get('summary', '')
            if summary and isinstance(summary, str):
                lead.ai_summary = summary
                lead.last_message = summary[:250] # ZaloLead uses last_message
                
        # 4. Handoff
        if result.get('sentiment') in ['angry', 'handoff']:
            lead.is_ai_active = False
            lead.has_unread_message = True
            
        lead.save()

        # 5. Gửi tin nhắn (có Human Typing)
        reply_text = result.get('reply')
        image_url = result.get('image_url')
        if image_url and isinstance(image_url, str) and image_url.startswith('/'):
            image_url = f"{get_public_domain()}{image_url}"
            
        # Check for function calling (product search)
        product_search_keyword = result.get('product_search_keyword')
        if product_search_keyword:
            from zalo_integration.services import send_zalo_carousel
            products_for_carousel = search_products_for_carousel(lead.company, product_search_keyword, limit=3)
            if products_for_carousel:
                send_zalo_carousel(lead.oa_config, lead.social_id, products_for_carousel)
                ZaloMessage.objects.create(
                    company=lead.company,
                    social_lead=lead,
                    direction=ZaloMessage.DIRECTION_OUTBOUND,
                    content=f"[Đã gửi Danh sách tìm kiếm: {product_search_keyword}]"
                )

        if reply_text or image_url:
            if ai_agent.enable_human_typing:
                import time
                delay = min(len(reply_text or '') * 0.03, 5.0) # max 5s delay
                time.sleep(delay)
                
            send_zalo_chat_message(lead.oa_config, lead.social_id, text=reply_text, image_url=image_url)
            ZaloMessage.objects.create(
                company=lead.company,
                social_lead=lead,
                direction=ZaloMessage.DIRECTION_OUTBOUND,
                content=reply_text or "[Hình ảnh]"
            )
            
            update_fields = []
            if lead.is_ai_active:
                lead.has_unread_message = False
                lead.unread_count = 0
                update_fields.extend(['has_unread_message', 'unread_count'])
            if is_followup:
                lead.has_ai_followed_up = True
                update_fields.append('has_ai_followed_up')
            if update_fields:
                lead.save(update_fields=update_fields)
    except Exception as e:
        logger.error(f'Zalo AI Task Error: {e}')

def process_ai_reply_facebook(lead_id, is_followup=False, trigger_msg_id=None):
    try:
        lead = FacebookLead.objects.get(id=lead_id)
        if not lead.page_config or not lead.page_config.is_ai_active or not lead.page_config.ai_agent:
            return
        if not lead.is_ai_active and not is_followup:
            return
            
        if not is_followup:
            import time
            delay = lead.page_config.ai_agent.debounce_delay
            time.sleep(delay)
            
        if not is_followup and trigger_msg_id:
            from facebook_integration.models import FacebookMessage
            latest_msg = FacebookMessage.objects.filter(lead=lead, sender_type='customer').order_by('-created_at').first()
            if latest_msg and latest_msg.id != trigger_msg_id:
                logger.info(f"Facebook AI debounce: Bỏ qua tin nhắn cũ {trigger_msg_id} do đã có tin mới {latest_msg.id}")
                return

        messages = FacebookMessage.objects.filter(lead=lead).order_by('-created_at')[:10]
        history = []
        visual_search_text = ""
        
        for m in reversed(messages):
            role = 'user' if m.sender_type == 'customer' else 'assistant'
            history.append({'role': role, 'content': m.text or '([Hình ảnh/File đính kèm])'})
            
        # Thử nhận diện ảnh nếu tin nhắn cuối cùng là ảnh
        latest_msg = messages.first()
        if latest_msg and latest_msg.sender_type == 'customer' and latest_msg.attachment_url:
            from ai_agents.image_recognition import get_image_embedding
            vector = get_image_embedding(image_path_or_url=latest_msg.attachment_url)
            if vector:
                from inventory.models import ProductTemplate
                from ai_agents.models import AiKnowledgeDocument
                from pgvector.django import CosineDistance
                
                visual_hints = []
                matched_product = ProductTemplate.objects.filter(
                    company=lead.company, 
                    image_vector__isnull=False
                ).annotate(distance=CosineDistance('image_vector', vector)).order_by('distance').first()
                
                if matched_product and getattr(matched_product, 'distance', 1) < 0.4:
                    visual_hints.append(f"- Sản phẩm tương tự nhất: {matched_product.name}")
                    
                matched_doc = AiKnowledgeDocument.objects.filter(
                    agent=lead.page_config.ai_agent,
                    image_vector__isnull=False
                ).annotate(distance=CosineDistance('image_vector', vector)).order_by('distance').first()
                
                if matched_doc and getattr(matched_doc, 'distance', 1) < 0.4:
                    visual_hints.append(f"- Tài liệu/Hình ảnh tham khảo tương đồng:\n  + Tiêu đề: {matched_doc.title}\n  + Nội dung mô tả: {matched_doc.content}")
                
                if visual_hints:
                    visual_search_text = "\n\n[HỆ THỐNG GỢI Ý (VISUAL SEARCH)]:\nKhách hàng vừa gửi 1 bức ảnh. AI Vision đã quét và tìm thấy thông tin liên quan trong hệ thống:\n" + "\n".join(visual_hints) + "\nHãy dựa vào đây để tư vấn!"
            
        if is_followup:
            history.append({'role': 'system', 'content': 'Khách hàng đã không phản hồi hơn 24 giờ. Hãy viết một câu chào hỏi, gợi mở hoặc hỏi thăm khéo léo để tiếp tục câu chuyện một cách tự nhiên nhất.'})

        result = generate_ai_reply(lead.page_config.ai_agent, history, lead.fb_user_name + visual_search_text)
        if result.get('error'):
            lead.is_ai_active = False
            lead.has_unread_message = True  # Đánh dấu để Sale thấy và vào xử lý
            lead.save(update_fields=['is_ai_active', 'has_unread_message'])
            return

        ai_agent = lead.page_config.ai_agent

        # 1. Trích xuất dữ liệu
        extracted = result.get('extracted_info', {})
        if isinstance(extracted, dict):
            phone = extracted.get('phone', '')
            if phone and isinstance(phone, str) and 'rỗng' not in phone.lower() and len(phone) > 8 and not lead.detected_phone:
                lead.detected_phone = phone
            address = extracted.get('address', '')
            if address and isinstance(address, str) and 'rỗng' not in address.lower() and len(address) > 5 and not lead.detected_address:
                lead.detected_address = address
                
        # 2. Gắn Tag
        if ai_agent.enable_auto_tagging:
            tags = result.get('tags', [])
            if isinstance(tags, list) and tags:
                clean_tags = [t.strip()[:50] for t in tags if isinstance(t, str) and t.strip()]
                if clean_tags:
                    lead.ai_tags = clean_tags
                        
        # 3. Tóm tắt hội thoại
        if ai_agent.enable_auto_summary:
            summary = result.get('summary', '')
            if summary and isinstance(summary, str):
                lead.ai_summary = summary
                lead.last_message_preview = summary[:250] # FacebookLead uses last_message_preview
                
        # 4. Handoff
        if result.get('sentiment') in ['angry', 'handoff']:
            lead.is_ai_active = False
            lead.has_unread_message = True
            
        lead.save()

        # 5. Gửi tin nhắn (có Human Typing)
        reply_text = result.get('reply')
        image_url = result.get('image_url')
        if image_url and isinstance(image_url, str) and image_url.startswith('/'):
            image_url = f"{get_public_domain()}{image_url}"
            
        if reply_text or image_url:
            if ai_agent.enable_human_typing:
                import time
                delay = min(len(reply_text or '') * 0.03, 5.0) # max 5s delay
                # Facebook supports typing_on
                import requests
                url = f"https://graph.facebook.com/v19.0/me/messages?access_token={lead.page_config.page_access_token}"
                payload = {
                    "recipient": {"id": lead.fb_user_id},
                    "sender_action": "typing_on"
                }
                requests.post(url, json=payload)
                time.sleep(delay)

        # Check for function calling (product search)
        product_search_keyword = result.get('product_search_keyword')
        if product_search_keyword:
            from facebook_integration.services import send_facebook_carousel
            products_for_carousel = search_products_for_carousel(lead.company, product_search_keyword, limit=3)
            if products_for_carousel:
                send_facebook_carousel(lead.page_config.page_access_token, lead.fb_user_id, products_for_carousel)
                FacebookMessage.objects.create(
                    lead=lead,
                    sender_type='page',
                    text=f"[Đã gửi Carousel tìm kiếm: {product_search_keyword}]"
                )

        if reply_text or image_url:
            send_facebook_message(lead.page_config.page_access_token, lead.fb_user_id, message_text=reply_text, attachment_url=image_url)
            FacebookMessage.objects.create(
                lead=lead,
                sender_type='page',
                text=reply_text or "[Hình ảnh]"
            )
            
            update_fields = []
            if lead.is_ai_active:
                lead.has_unread_message = False
                lead.unread_count = 0
                update_fields.extend(['has_unread_message', 'unread_count'])
            if is_followup:
                lead.has_ai_followed_up = True
                update_fields.append('has_ai_followed_up')
            if update_fields:
                lead.save(update_fields=update_fields)
    except Exception as e:
        logger.error(f'Facebook AI Task Error: {e}')

def trigger_zalo_ai(lead_id, is_followup=False):
    from zalo_integration.models import ZaloMessage
    latest_msg = None
    if not is_followup:
        latest_msg = ZaloMessage.objects.filter(social_lead_id=lead_id, direction=ZaloMessage.DIRECTION_INBOUND).order_by('-created_at').first()
    msg_id = latest_msg.id if latest_msg else None
    threading.Thread(target=process_ai_reply_zalo, args=(lead_id, is_followup, msg_id)).start()

def trigger_facebook_ai(lead_id, is_followup=False):
    from facebook_integration.models import FacebookMessage
    latest_msg = None
    if not is_followup:
        latest_msg = FacebookMessage.objects.filter(lead_id=lead_id, sender_type='customer').order_by('-created_at').first()
    msg_id = latest_msg.id if latest_msg else None
    threading.Thread(target=process_ai_reply_facebook, args=(lead_id, is_followup, msg_id)).start()

from celery import shared_task
from datetime import timedelta

@shared_task(name="ai_agents.drip_followup")
def ai_drip_followup():
    """
    Tự động follow-up khách hàng nếu không phản hồi sau số giờ cấu hình (mặc định 24h).
    """
    logger.info("[AI FollowUp] Bắt đầu quét follow-up...")
    now = timezone.now()
    
    # Lấy danh sách các agent có bật tính năng follow-up
    agents = AiAgent.objects.filter(enable_drip_followup=True, is_active=True)
    
    for agent in agents:
        hours = agent.drip_followup_hours or 24
        cutoff_start = now - timedelta(hours=hours + 1)
        cutoff_end = now - timedelta(hours=hours)
        
        # 1. Quét Zalo
        zalo_leads = ZaloLead.objects.filter(
            is_customer_converted=False,
            has_ai_followed_up=False,
            oa_config__ai_agent=agent,
            last_interaction_date__gte=cutoff_start,
            last_interaction_date__lte=cutoff_end
        )
        
        for lead in zalo_leads:
            logger.info(f"[AI FollowUp] Trigger Zalo Follow-up cho {lead.social_id} sau {hours}h")
            trigger_zalo_ai(lead.id, is_followup=True)

        # 2. Quét Facebook
        fb_leads = FacebookLead.objects.filter(
            is_customer_converted=False,
            has_ai_followed_up=False,
            page_config__ai_agent=agent,
            last_message_at__gte=cutoff_start,
            last_message_at__lte=cutoff_end
        )

        for lead in fb_leads:
            logger.info(f"[AI FollowUp] Trigger Facebook Follow-up cho {lead.fb_user_id} sau {hours}h")
            trigger_facebook_ai(lead.id, is_followup=True)
            
    logger.info("[AI FollowUp] Hoàn thành quét follow-up.")



@shared_task
def sync_ai_model_pricing():
    import requests
    from decimal import Decimal
    from .models import AiModelPricing, SystemAiKey, CompanyAiKey
    import logging
    logger = logging.getLogger(__name__)
    
    # Thu thập danh sách mô hình thực tế từ API
    allowed_models = set([
        'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 
        'claude-opus-4-5', 'claude-sonnet-4-5'
    ])
    
    # Lấy 1 key active cho OpenAI
    openai_key = SystemAiKey.objects.filter(provider='openai', is_active=True).first()
    if not openai_key:
        openai_key = CompanyAiKey.objects.filter(provider='openai', is_active=True).first()
    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key.api_key)
            models = client.models.list()
            for m in models.data:
                allowed_models.add(m.id)
        except Exception as e:
            logger.error(f'OpenAI fetch models error: {e}')

    # Lấy 1 key active cho Gemini
    gemini_key = SystemAiKey.objects.filter(provider='gemini', is_active=True).first()
    if not gemini_key:
        gemini_key = CompanyAiKey.objects.filter(provider='gemini', is_active=True).first()
    if gemini_key:
        try:
            from google import genai as google_genai
            client = google_genai.Client(api_key=gemini_key.api_key)
            for m in client.models.list():
                if hasattr(m, 'supported_actions') and m.supported_actions and 'generateContent' in m.supported_actions:
                    allowed_models.add(m.name.replace('models/', ''))
        except Exception as e:
            logger.error(f'Gemini fetch models error: {e}')

    url = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
    logger.info(f'Đang đồng bộ giá AI từ: {url}')
    
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        updated_count = 0
        created_count = 0
        
        for model_name, info in data.items():
            if not isinstance(info, dict):
                continue
                
            input_price = info.get('input_cost_per_token', 0)
            output_price = info.get('output_cost_per_token', 0)
            provider = info.get('litellm_provider', 'unknown')
            
            if provider not in ['openai', 'gemini', 'anthropic']:
                continue
                
            if model_name not in allowed_models:
                clean_name = model_name.split('/')[-1]
                if clean_name not in allowed_models:
                    continue
                model_name = clean_name
            else:
                model_name = model_name.split('/')[-1]
            
            if input_price is None or output_price is None:
                continue
                
            try:
                input_per_1m = Decimal(str(input_price)) * Decimal('1000000')
                output_per_1m = Decimal(str(output_price)) * Decimal('1000000')
                
                pricing, created = AiModelPricing.objects.get_or_create(
                    model_name=model_name,
                    defaults={
                        'provider': provider,
                        'input_price_per_1m': input_per_1m,
                        'output_price_per_1m': output_per_1m
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    if not pricing.is_custom:
                        pricing.provider = provider
                        pricing.input_price_per_1m = input_per_1m
                        pricing.output_price_per_1m = output_per_1m
                        pricing.save(update_fields=['provider', 'input_price_per_1m', 'output_price_per_1m', 'updated_at'])
                        updated_count += 1
            except Exception as e:
                logger.error(f'Lỗi parse {model_name}: {e}')
                
        logger.info(f'Xong. Tạo mới {created_count}, Cập nhật {updated_count}')
        return {'created': created_count, 'updated': updated_count}
    except Exception as e:
        logger.error(f'Lỗi đồng bộ: {e}')
        return {'error': str(e)}

@shared_task
def process_document_rag(doc_id):
    """
    Celery task để xử lý tài liệu RAG ngầm.
    """
    from .models import AiKnowledgeDocument
    from .rag_processor import process_and_save_document
    from .services import get_api_keys
    
    try:
        doc = AiKnowledgeDocument.objects.get(id=doc_id)
        provider = getattr(doc.agent.company.ai_settings, 'default_embedding_provider', 'openai')
        
        # Lưu lại nền tảng đọc vào doc
        doc.embedding_provider = provider
        doc.save(update_fields=['embedding_provider'])
        
        # Lấy API key dựa trên provider đã chọn
        keys = get_api_keys(doc.agent.company, provider)
        api_key = keys[0] if keys else None
        
        # NẾU LÀ ẢNH MẪU (doc_type='image'): Chỉ vectorize ảnh và lưu mô tả, không cần Embedding text
        if doc.doc_type == 'image' and doc.file_attachment:
            ext = doc.file_attachment.name.lower().split('.')[-1]
            if ext in ['jpg', 'jpeg', 'png', 'webp']:
                from .image_recognition import get_image_embedding
                vector = get_image_embedding(image_path_or_url=doc.file_attachment.path)
                if vector:
                    doc.image_vector = vector
                    doc.status = 'ready'
                    doc.save(update_fields=['image_vector', 'status'])
                else:
                    doc.status = 'failed'
                    doc.error_message = 'Không thể trích xuất vector từ ảnh. Ảnh có thể bị lỗi hoặc model CLIP chưa sẵn sàng.'
                    doc.save(update_fields=['status', 'error_message'])
            return  # Không cần chạy RAG cho ảnh

        # Kiểm tra API Key cho RAG text
        if not api_key:
            doc.status = 'failed'
            doc.error_message = f'Không tìm thấy API Key hợp lệ cho {provider.upper()} để thực hiện nhúng (Embedding).'
            doc.save()
            return
            
        # NẾU CÓ ẢNH KÈM TRONG FILE: Vectorize thêm ảnh song song
        if doc.file_attachment:
            ext = doc.file_attachment.name.lower().split('.')[-1]
            if ext in ['jpg', 'jpeg', 'png', 'webp']:
                from .image_recognition import get_image_embedding
                vector = get_image_embedding(image_path_or_url=doc.file_attachment.path)
                if vector:
                    doc.image_vector = vector
                    doc.save(update_fields=['image_vector'])
            
        # Thực hiện xử lý RAG (Text)
        process_and_save_document(doc.id, api_key, provider)
    except Exception as e:
        # Catch any unexpected errors
        try:
            doc = AiKnowledgeDocument.objects.get(id=doc_id)
            doc.status = 'failed'
            doc.error_message = str(e)
            doc.save()
        except:
            pass


@shared_task
def sync_company_products_to_rag(company_id):
    """
    Task ngầm đồng bộ toàn bộ sản phẩm của công ty vào Knowledge Base của AI.
    """
    from inventory.models import Product
    from .models import AiKnowledgeDocument, AiAgent
    
    products = Product.objects.filter(company_id=company_id).order_by('name')
    if not products.exists():
        return
        
    # Tạo nội dung tổng hợp
    content_lines = ["# BẢNG GIÁ VÀ THÔNG SỐ SẢN PHẨM / DỊCH VỤ\n"]
    for p in products:
        line = f"- Tên sản phẩm: {p.name}"
        if getattr(p, 'sku', None):
            line += f" (Mã: {p.sku})"
        if getattr(p, 'price', None):
            line += f" | Giá bán: {p.price:,.0f} VNĐ"
        if getattr(p, 'unit', None):
            line += f" / {p.get_unit_display()}"
        
        description = getattr(p.template, 'description', None) if p.template else None
        if description:
            line += f" | Mô tả: {description}"
            
        if getattr(p.template, 'image', None):
            line += f" | Hình ảnh (URL): {p.template.image.url}"
            
        content_lines.append(line)
        
    full_content = "\n".join(content_lines)
    
    # Lấy Agent đầu tiên của công ty để gán tài liệu (tạm thời)
    # Trong tương lai có thể gán cho toàn bộ Agent
    first_agent = AiAgent.objects.filter(company_id=company_id).first()
    if not first_agent:
        return
        
    provider = getattr(first_agent.company.ai_settings, 'default_embedding_provider', 'openai')
    doc, created = AiKnowledgeDocument.objects.get_or_create(
        agent=first_agent,
        title='Danh mục Sản phẩm Hệ thống (Auto)',
        doc_type='file',
        defaults={'content': full_content, 'status': 'pending', 'embedding_provider': provider}
    )
    
    if not created:
        doc.content = full_content
        doc.status = 'pending'
        doc.embedding_provider = provider
        doc.save()
        
    # Kích hoạt học RAG
    process_document_rag.delay(doc.id)
