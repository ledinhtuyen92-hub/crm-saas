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



def process_ai_reply_zalo(lead_id, is_followup=False):
    try:
        lead = ZaloLead.objects.get(id=lead_id)
        if not lead.is_ai_active or not lead.oa_config or not lead.oa_config.is_ai_active or not lead.oa_config.ai_agent:
            return

        # Lấy lịch sử
        messages = ZaloMessage.objects.filter(social_lead=lead).order_by('-created_at')[:10]
        history = []
        for m in reversed(messages):
            role = 'user' if m.direction == ZaloMessage.DIRECTION_INBOUND else 'assistant'
            history.append({'role': role, 'content': m.content or '([Hình ảnh/File đính kèm])'})
            
        if is_followup:
            history.append({'role': 'system', 'content': 'Khách hàng đã không phản hồi hơn 24 giờ. Hãy viết một câu chào hỏi, gợi mở hoặc hỏi thăm khéo léo để tiếp tục câu chuyện một cách tự nhiên nhất.'})

        result = generate_ai_reply(lead.oa_config.ai_agent, history, lead.display_name)
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
                from zalo_integration.models import ZaloLeadTag
                for tag_name in tags:
                    if isinstance(tag_name, str) and tag_name.strip():
                        tag_obj, _ = ZaloLeadTag.objects.get_or_create(company=lead.company, name=tag_name.strip()[:50])
                        lead.tags.add(tag_obj)
                        
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
        if reply_text:
            if ai_agent.enable_human_typing:
                import time
                delay = min(len(reply_text) * 0.03, 5.0) # max 5s delay
                time.sleep(delay)
                
            send_zalo_chat_message(lead.oa_config, lead.social_id, text=reply_text)
            ZaloMessage.objects.create(
                company=lead.company,
                social_lead=lead,
                direction=ZaloMessage.DIRECTION_OUTBOUND,
                content=reply_text
            )
            
            if lead.is_ai_active:
                lead.has_unread_message = False
                lead.unread_count = 0
                lead.save(update_fields=['has_unread_message', 'unread_count'])
    except Exception as e:
        logger.error(f'Zalo AI Task Error: {e}')

def process_ai_reply_facebook(lead_id, is_followup=False):
    try:
        lead = FacebookLead.objects.get(id=lead_id)
        if not lead.is_ai_active or not lead.page_config or not lead.page_config.is_ai_active or not lead.page_config.ai_agent:
            return

        messages = FacebookMessage.objects.filter(lead=lead).order_by('-created_at')[:10]
        history = []
        for m in reversed(messages):
            role = 'user' if m.sender_type == 'customer' else 'assistant'
            history.append({'role': role, 'content': m.text or '([Hình ảnh/File đính kèm])'})
            
        if is_followup:
            history.append({'role': 'system', 'content': 'Khách hàng đã không phản hồi hơn 24 giờ. Hãy viết một câu chào hỏi, gợi mở hoặc hỏi thăm khéo léo để tiếp tục câu chuyện một cách tự nhiên nhất.'})

        result = generate_ai_reply(lead.page_config.ai_agent, history, lead.fb_user_name)
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
                from facebook_integration.models import FacebookLeadTag
                for tag_name in tags:
                    if isinstance(tag_name, str) and tag_name.strip():
                        tag_obj, _ = FacebookLeadTag.objects.get_or_create(company=lead.company, name=tag_name.strip()[:50])
                        lead.tags.add(tag_obj)
                        
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
        if reply_text:
            if ai_agent.enable_human_typing:
                import time
                delay = min(len(reply_text) * 0.03, 5.0) # max 5s delay
                # Facebook supports typing_on
                import requests
                url = f"https://graph.facebook.com/v19.0/me/messages?access_token={lead.page_config.page_access_token}"
                payload = {
                    "recipient": {"id": lead.fb_user_id},
                    "sender_action": "typing_on"
                }
                requests.post(url, json=payload)
                time.sleep(delay)

            send_facebook_message(lead.page_config.page_access_token, lead.fb_user_id, reply_text)
            FacebookMessage.objects.create(
                lead=lead,
                sender_type='page',
                text=reply_text
            )
            
            if lead.is_ai_active:
                lead.has_unread_message = False
                lead.unread_count = 0
                lead.save(update_fields=['has_unread_message', 'unread_count'])
    except Exception as e:
        logger.error(f'Facebook AI Task Error: {e}')

def trigger_zalo_ai(lead_id, is_followup=False):
    threading.Thread(target=process_ai_reply_zalo, args=(lead_id, is_followup)).start()

def trigger_facebook_ai(lead_id, is_followup=False):
    threading.Thread(target=process_ai_reply_facebook, args=(lead_id, is_followup)).start()

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
            is_ai_active=True,
            oa_config__ai_agent=agent,
            last_interaction_date__gte=cutoff_start,
            last_interaction_date__lte=cutoff_end
        )
        
        for lead in zalo_leads:
            last_2_msgs = ZaloMessage.objects.filter(social_lead=lead).order_by('-created_at')[:2]
            if len(last_2_msgs) > 0 and last_2_msgs[0].direction == ZaloMessage.DIRECTION_OUTBOUND:
                if len(last_2_msgs) == 2 and last_2_msgs[1].direction == ZaloMessage.DIRECTION_OUTBOUND:
                    logger.info(f"[AI FollowUp] Bỏ qua {lead.social_id} vì đã follow-up trước đó.")
                    continue
                logger.info(f"[AI FollowUp] Trigger Zalo Follow-up cho {lead.social_id} sau {hours}h")
                trigger_zalo_ai(lead.id, is_followup=True)

        # 2. Quét Facebook
        fb_leads = FacebookLead.objects.filter(
            is_ai_active=True,
            page_config__ai_agent=agent,
            last_message_at__gte=cutoff_start,
            last_message_at__lte=cutoff_end
        )

        for lead in fb_leads:
            last_2_msgs = FacebookMessage.objects.filter(lead=lead).order_by('-created_at')[:2]
            if len(last_2_msgs) > 0 and last_2_msgs[0].sender_type == 'page':
                if len(last_2_msgs) == 2 and last_2_msgs[1].sender_type == 'page':
                    logger.info(f"[AI FollowUp] Bỏ qua {lead.fb_user_id} vì đã follow-up trước đó.")
                    continue
                logger.info(f"[AI FollowUp] Trigger Facebook Follow-up cho {lead.fb_user_id} sau {hours}h")
                trigger_facebook_ai(lead.id, is_followup=True)
            
    logger.info("[AI FollowUp] Hoàn thành quét follow-up.")
