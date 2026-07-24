from django.contrib import admin
from .models import SystemAiKey, CompanyAiSettings, AiAgent, AiKnowledgeDocument

@admin.register(SystemAiKey)
class SystemAiKeyAdmin(admin.ModelAdmin):
    list_display = ('provider', 'api_key', 'is_active', 'priority')
    list_filter = ('provider', 'is_active')

@admin.register(CompanyAiSettings)
class CompanyAiSettingsAdmin(admin.ModelAdmin):
    list_display = ('company', 'use_system_keys')

@admin.register(AiAgent)
class AiAgentAdmin(admin.ModelAdmin):
    list_display = ('name', 'company', 'model_name', 'is_active')
    list_filter = ('is_active', 'model_name')

@admin.register(AiKnowledgeDocument)
class AiKnowledgeDocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'agent', 'created_at')
