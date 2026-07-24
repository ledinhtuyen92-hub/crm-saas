from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SystemAiKeyViewSet, CompanyAiSettingsViewSet, AiAgentViewSet, AiKnowledgeDocumentViewSet

router = DefaultRouter()
router.register(r'system-keys', SystemAiKeyViewSet, basename='system-ai-keys')
router.register(r'agents', AiAgentViewSet, basename='ai-agents')
router.register(r'knowledge', AiKnowledgeDocumentViewSet, basename='ai-knowledge')
router.register(r'settings', CompanyAiSettingsViewSet, basename='company-ai-settings')

urlpatterns = [
    path('', include(router.urls)),
]
