from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Product
from ai_agents.tasks import sync_company_products_to_rag

@receiver(post_save, sender=Product)
@receiver(post_delete, sender=Product)
def product_sync_to_rag(sender, instance, **kwargs):
    company = instance.company
    # Kiểm tra xem công ty có cấu hình bật tự động đồng bộ RAG không
    if hasattr(company, 'ai_settings') and company.ai_settings.auto_sync_products:
        sync_company_products_to_rag.delay(company.id)

from .models import ProductTemplate

@receiver(post_save, sender=ProductTemplate)
def trigger_sync_product_image_vector(sender, instance, created, **kwargs):
    if instance.image and not getattr(instance, '_vector_syncing', False):
        try:
            from ai_agents.tasks import sync_product_image_vector
            sync_product_image_vector.delay(instance.id)
        except Exception:
            pass
