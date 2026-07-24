from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import SystemAiKey, CompanyAiSettings, AiAgent, AiKnowledgeDocument
from .serializers import SystemAiKeySerializer, CompanyAiSettingsSerializer, AiAgentSerializer, AiKnowledgeDocumentSerializer

class SystemAiKeyViewSet(viewsets.ModelViewSet):
    queryset = SystemAiKey.objects.all().order_by('-priority', '-created_at')
    serializer_class = SystemAiKeySerializer
    permission_classes = [permissions.IsAdminUser]

class AiAgentViewSet(viewsets.ModelViewSet):
    serializer_class = AiAgentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return AiAgent.objects.filter(company=self.request.user.company)
        
    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)

class AiKnowledgeDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = AiKnowledgeDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return AiKnowledgeDocument.objects.filter(agent__company=self.request.user.company)

class CompanyAiSettingsViewSet(viewsets.ModelViewSet):
    serializer_class = CompanyAiSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return CompanyAiSettings.objects.filter(company=self.request.user.company)
        
    @action(detail=False, methods=['GET', 'PUT', 'PATCH'])
    def mine(self, request):
        settings, _ = CompanyAiSettings.objects.get_or_create(company=request.user.company)
        if request.method == 'GET':
            return Response(self.get_serializer(settings).data)
        else:
            serializer = self.get_serializer(settings, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
