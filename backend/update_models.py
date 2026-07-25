import sys

with open('ai_agents/models.py', 'r', encoding='utf-8') as f:
    content = f.read()

import_str = 'from pgvector.django import VectorField\n'
if import_str not in content:
    content = content.replace('from users.models import Company\n', 'from users.models import Company\n' + import_str)

old_class = '''class AiKnowledgeDocument(models.Model):
    """
    Tài liệu tri thức (RAG) được gán cho AI.
    """
    agent = models.ForeignKey(AiAgent, on_delete=models.CASCADE, related_name='knowledge_docs')
    title = models.CharField(max_length=200)
    content = models.TextField(help_text="Nội dung văn bản (hoặc trích xuất từ file)")
    file_attachment = models.FileField(upload_to='ai_docs/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.title'''

new_class = '''class AiKnowledgeDocument(models.Model):
    """
    Tài liệu tri thức (RAG) được gán cho AI.
    """
    agent = models.ForeignKey(AiAgent, on_delete=models.CASCADE, related_name='knowledge_docs')
    title = models.CharField(max_length=200)
    content = models.TextField(help_text="Nội dung văn bản (hoặc trích xuất từ file)", blank=True)
    file_attachment = models.FileField(upload_to='ai_docs/', blank=True, null=True)
    
    DOC_TYPE_CHOICES = (
        ('file', 'File tài liệu'),
        ('qa', 'Hỏi - Đáp (Q&A)'),
    )
    doc_type = models.CharField(max_length=20, choices=DOC_TYPE_CHOICES, default='file')
    
    STATUS_CHOICES = (
        ('pending', 'Chờ xử lý'),
        ('processing', 'Đang học'),
        ('completed', 'Hoàn thành'),
        ('failed', 'Lỗi'),
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

class AiKnowledgeChunk(models.Model):
    """
    Lưu trữ các đoạn văn bản (chunks) đã được băm nhỏ từ AiKnowledgeDocument
    kèm theo vector nhúng (embedding) để tìm kiếm Semantic Search.
    """
    document = models.ForeignKey(AiKnowledgeDocument, on_delete=models.CASCADE, related_name='chunks')
    content = models.TextField(help_text="Nội dung đoạn text đã băm nhỏ")
    embedding = VectorField(dimensions=1536, help_text="Vector embedding (VD: text-embedding-3-small)", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Chunk of {self.document.title}"'''

if old_class in content:
    content = content.replace(old_class, new_class)
    with open('ai_agents/models.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Done!')
else:
    print('Error: old_class not found in models.py')