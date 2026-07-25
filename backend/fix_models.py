import sys

with open('ai_agents/models.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.split('class ApiUsageLog')[0]

missing_classes = '''
class ApiUsageLog(models.Model):
    """
    Theo dõi lượng token và chi phí API của từng công ty.
    """
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='api_usage_logs')
    agent = models.ForeignKey(AiAgent, on_delete=models.SET_NULL, null=True, blank=True, related_name='usage_logs')
    provider = models.CharField(max_length=50) # openai, gemini, anthropic
    model_name = models.CharField(max_length=100)
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    total_cost_usd = models.DecimalField(max_digits=12, decimal_places=6, default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.company.name} - {self.model_name} - {self.total_cost_usd}$"

class AiModelPricing(models.Model):
    """
    Bảng giá AI model để tham chiếu. Có thể tự động bét từ LiteLLM hoặc chỉnh sửa thủ công.
    """
    provider = models.CharField(max_length=50) # openai, gemini, anthropic...
    model_name = models.CharField(max_length=100, unique=True)
    input_price_per_1m = models.DecimalField(max_digits=12, decimal_places=6, default=0.0)
    output_price_per_1m = models.DecimalField(max_digits=12, decimal_places=6, default=0.0)
    is_custom = models.BooleanField(default=False, help_text="Nếu True, auto-sync sẽ không ghi đè giá này.")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.model_name} ({self.provider}) - Input: {self.input_price_per_1m}$ - Output: {self.output_price_per_1m}$"
'''

content += missing_classes

with open('ai_agents/models.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed models.py")