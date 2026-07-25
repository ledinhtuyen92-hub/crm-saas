import sys

with open('ai_agents/views.py', 'r', encoding='utf-8') as f:
    content = f.read()

import_tasks = "from .tasks import process_document_rag\nfrom rest_framework.response import Response\nfrom .models import AiKnowledgeChunk\n"
if "process_document_rag" not in content:
    content = content.replace("from .models import SystemAiKey", import_tasks + "from .models import SystemAiKey")

old_view = '''class AiKnowledgeDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = AiKnowledgeDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return AiKnowledgeDocument.objects.filter(agent__company=self.request.user.company)'''

new_view = '''class AiKnowledgeDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = AiKnowledgeDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return AiKnowledgeDocument.objects.filter(agent__company=self.request.user.company)
        
    def perform_create(self, serializer):
        doc = serializer.save()
        process_document_rag.delay(doc.id)
        
    def perform_update(self, serializer):
        doc = serializer.save()
        doc.status = 'pending'
        doc.error_message = ''
        doc.save()
        process_document_rag.delay(doc.id)

    @action(detail=False, methods=['POST'])
    def test_retrieval(self, request):
        query = request.data.get('query', '')
        agent_id = request.data.get('agent_id')
        
        if not query or not agent_id:
            return Response({'error': 'Vui lòng cung cấp query và agent_id'}, status=400)
            
        from .services import get_provider_and_key
        from openai import OpenAI
        from users.models import Company
        
        # Lấy API Key để embed câu hỏi
        company = request.user.company
        provider, api_key = get_provider_and_key(company, provider_override='openai')
        
        if not api_key:
            return Response({'error': 'Không có OpenAI API Key hợp lệ để tìm kiếm'}, status=400)
            
        try:
            client = OpenAI(api_key=api_key)
            res = client.embeddings.create(input=[query], model="text-embedding-3-small")
            query_embedding = res.data[0].embedding
            
            # Tìm kiếm vector bằng pgvector (L2 distance or Cosine)
            from pgvector.django import L2Distance
            chunks = AiKnowledgeChunk.objects.filter(
                document__agent_id=agent_id
            ).annotate(
                distance=L2Distance('embedding', query_embedding)
            ).order_by('distance')[:3]
            
            results = []
            for chunk in chunks:
                results.append({
                    'document': chunk.document.title,
                    'content': chunk.content,
                    'distance': chunk.distance
                })
                
            return Response({'results': results})
        except Exception as e:
            return Response({'error': str(e)}, status=500)'''

if old_view in content:
    content = content.replace(old_view, new_view)
    with open('ai_agents/views.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated views.py")
else:
    print("Error: old_view not found in views.py")