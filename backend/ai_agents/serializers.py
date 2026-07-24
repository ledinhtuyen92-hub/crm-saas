from rest_framework import serializers
from .models import SystemAiKey, CompanyAiSettings, AiAgent, AiKnowledgeDocument

class SystemAiKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemAiKey
        fields = '__all__'

class AiKnowledgeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiKnowledgeDocument
        fields = '__all__'

class AiAgentSerializer(serializers.ModelSerializer):
    knowledge_docs = AiKnowledgeDocumentSerializer(many=True, read_only=True)
    class Meta:
        model = AiAgent
        fields = '__all__'
        read_only_fields = ['company']

class CompanyAiSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyAiSettings
        fields = '__all__'
        read_only_fields = ['company']
