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

def process_ai_reply_zalo(lead_id):
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

        result = generate_ai_reply(lead.oa_config.ai_agent, history, lead.display_name)
        
        if result.get('sentiment') == 'angry':
            lead.is_ai_active = False
            lead.save()
            # Thông báo sale? Có thể gửi webhook nội bộ

        reply_text = result.get('reply')
        if reply_text:
            send_zalo_chat_message(lead.oa_config, lead.social_id, text=reply_text)
            ZaloMessage.objects.create(
                company=lead.company,
                social_lead=lead,
                direction=ZaloMessage.DIRECTION_OUTBOUND,
                content=reply_text
            )
    except Exception as e:
        logger.error(f'Zalo AI Task Error: {e}')

def process_ai_reply_facebook(lead_id):
    try:
        lead = FacebookLead.objects.get(id=lead_id)
        if not lead.is_ai_active or not lead.page_config or not lead.page_config.is_ai_active or not lead.page_config.ai_agent:
            return

        messages = FacebookMessage.objects.filter(lead=lead).order_by('-created_at')[:10]
        history = []
        for m in reversed(messages):
            role = 'user' if m.sender_type == 'customer' else 'assistant'
            history.append({'role': role, 'content': m.text or '([Hình ảnh/File đính kèm])'})

        result = generate_ai_reply(lead.page_config.ai_agent, history, lead.fb_user_name)

        if result.get('sentiment') == 'angry':
            lead.is_ai_active = False
            lead.save()

        reply_text = result.get('reply')
        if reply_text:
            send_facebook_message(lead.page_config.page_access_token, lead.fb_user_id, reply_text)
            FacebookMessage.objects.create(
                company=lead.company,
                lead=lead,
                sender_type='page',
                text=reply_text
            )
    except Exception as e:
        logger.error(f'Facebook AI Task Error: {e}')

def trigger_zalo_ai(lead_id):
    threading.Thread(target=process_ai_reply_zalo, args=(lead_id,)).start()

def trigger_facebook_ai(lead_id):
    threading.Thread(target=process_ai_reply_facebook, args=(lead_id,)).start()

from celery import shared_task
from datetime import timedelta

@shared_task(name="ai_agents.drip_followup")
def ai_drip_followup():
    """
    Tự động follow-up khách hàng nếu không phản hồi sau 24h.
    """
    logger.info("[AI FollowUp] Bắt đầu quét follow-up...")
    now = timezone.now()
    cutoff_start = now - timedelta(hours=25)
    cutoff_end = now - timedelta(hours=24)

    # 1. Quét Zalo
    zalo_leads = ZaloLead.objects.filter(
        is_ai_active=True,
        oa_config__ai_agent__isnull=False,
        oa_config__ai_agent__enable_drip_followup=True,
        last_interaction_date__gte=cutoff_start,
        last_interaction_date__lte=cutoff_end
    )
    
    for lead in zalo_leads:
        last_msg = ZaloMessage.objects.filter(social_lead=lead).order_by('-created_at').first()
        if last_msg and last_msg.direction == ZaloMessage.DIRECTION_OUTBOUND:
            logger.info(f"[AI FollowUp] Trigger Zalo Follow-up cho {lead.social_id}")
            trigger_zalo_ai(lead.id)

    # 2. Quét Facebook
    fb_leads = FacebookLead.objects.filter(
        is_ai_active=True,
        page_config__ai_agent__isnull=False,
        page_config__ai_agent__enable_drip_followup=True,
        last_message_at__gte=cutoff_start,
        last_message_at__lte=cutoff_end
    )

    for lead in fb_leads:
        last_msg = FacebookMessage.objects.filter(lead=lead).order_by('-created_at').first()
        if last_msg and last_msg.sender_type == 'page':
            logger.info(f"[AI FollowUp] Trigger Facebook Follow-up cho {lead.fb_user_id}")
            trigger_facebook_ai(lead.id)
            
    logger.info("[AI FollowUp] Hoàn thành quét follow-up.")
