from django.db import models
from users.models import Company

class SystemAiKey(models.Model):
    """
    Kho API Key hệ thống do Super Admin quản lý.
    """
    PROVIDER_CHOICES = (
        ('openai', 'OpenAI'),
        ('anthropic', 'Anthropic'),
        ('gemini', 'Google Gemini'),
    )
    provider = models.CharField(max_length=50, choices=PROVIDER_CHOICES, default='openai')
    api_key = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    priority = models.IntegerField(default=0, help_text="Độ ưu tiên (cao hơn sẽ được chọn trước)")
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.provider} - {self.api_key[:8]}..."

class CompanyAiSettings(models.Model):
    """
    Cấu hình AI chung cho toàn công ty.
    """
    company = models.OneToOneField(Company, on_delete=models.CASCADE, related_name='ai_settings')
    use_system_keys = models.BooleanField(default=True, help_text="Sử dụng quota của hệ thống")
    custom_openai_key = models.CharField(max_length=255, blank=True, null=True)
    custom_anthropic_key = models.CharField(max_length=255, blank=True, null=True)
    custom_gemini_key = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"AI Settings cho {self.company.name}"

class AiAgent(models.Model):
    """
    Trợ lý AI (Multi-Agent). Một công ty có thể tạo nhiều AI với tính cách khác nhau.
    """
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='ai_agents')
    name = models.CharField(max_length=100, help_text="Ví dụ: AI CSKH Zalo, AI Chốt Sale Fanpage")
    
    MODEL_CHOICES = (
        ('gpt-4o-mini', 'GPT-4o-mini (Nhanh, Rẻ)'),
        ('gpt-4o', 'GPT-4o (Thông minh nhất)'),
        ('claude-3-5-sonnet', 'Claude 3.5 Sonnet (Logic cao)'),
        ('gemini-1.5-flash', 'Gemini 1.5 Flash (Xử lý đa phương tiện)'),
    )
    model_name = models.CharField(max_length=50, choices=MODEL_CHOICES, default='gpt-4o-mini')
    system_prompt = models.TextField(help_text="Nhân cách và hướng dẫn hành vi cho AI", blank=True)
    temperature = models.FloatField(default=0.7, help_text="Độ sáng tạo (0 - 1)")
    
    # Các tùy chọn nâng cao (Toggles)
    enable_human_typing = models.BooleanField(default=False, verbose_name="Giả lập gõ phím")
    enable_auto_summary = models.BooleanField(default=True, verbose_name="Tóm tắt hội thoại cho Sale")
    enable_auto_tagging = models.BooleanField(default=False, verbose_name="Tự động gắn thẻ Inbox")
    enable_drip_followup = models.BooleanField(default=False, verbose_name="Tự động bám đuổi (Follow-up 24h)")
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.company.name})"

class AiKnowledgeDocument(models.Model):
    """
    Tài liệu tri thức (RAG) được gán cho AI.
    """
    agent = models.ForeignKey(AiAgent, on_delete=models.CASCADE, related_name='knowledge_docs')
    title = models.CharField(max_length=200)
    content = models.TextField(help_text="Nội dung văn bản (hoặc trích xuất từ file)")
    file_attachment = models.FileField(upload_to='ai_docs/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.title
