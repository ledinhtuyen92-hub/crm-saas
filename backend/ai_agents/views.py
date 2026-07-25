from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import SystemAiKey, CompanyAiSettings, AiAgent, AiKnowledgeDocument, CompanyAiKey
from .serializers import SystemAiKeySerializer, CompanyAiSettingsSerializer, AiAgentSerializer, AiKnowledgeDocumentSerializer, CompanyAiKeySerializer

class SystemAiKeyViewSet(viewsets.ModelViewSet):
    queryset = SystemAiKey.objects.all().order_by('-priority', '-created_at')
    serializer_class = SystemAiKeySerializer
    permission_classes = [permissions.IsAdminUser]

class CompanyAiKeyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanyAiKeySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CompanyAiKey.objects.filter(company=self.request.user.company).order_by('-priority', '-created_at')

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)

class AiAgentViewSet(viewsets.ModelViewSet):
    serializer_class = AiAgentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return AiAgent.objects.filter(company=self.request.user.company)
        
    def perform_create(self, serializer):
        self._verify_agent_model(serializer.validated_data)
        serializer.save(company=self.request.user.company)

    def perform_update(self, serializer):
        self._verify_agent_model(serializer.validated_data)
        serializer.save()
        
    def _verify_agent_model(self, validated_data):
        from rest_framework import serializers
        provider = validated_data.get('provider')
        model_name = validated_data.get('model_name')
        
        if provider and model_name:
            from .services import get_api_keys
            company = self.request.user.company
            keys = get_api_keys(company, provider)
            if keys:
                api_key = keys[0]
                try:
                    if provider == 'gemini':
                        from google import genai as google_genai
                        client = google_genai.Client(api_key=api_key)
                        client.models.generate_content(model=model_name, contents="hi")
                    elif provider == 'openai':
                        from openai import OpenAI
                        client = OpenAI(api_key=api_key)
                        client.chat.completions.create(
                            model=model_name,
                            messages=[{"role": "user", "content": "hi"}],
                            max_completion_tokens=1
                        )
                    elif provider == 'anthropic':
                        from anthropic import Anthropic
                        client = Anthropic(api_key=api_key)
                        client.messages.create(
                            model=model_name,
                            max_tokens=1,
                            messages=[{"role": "user", "content": "hi"}]
                        )
                except Exception as e:
                    err = str(e).lower()
                    if '429' in err or 'quota' in err or 'resource_exhausted' in err:
                        raise serializers.ValidationError({"model_name": f"API Key của bạn đã hết Quota hoặc Rate Limit. Vui lòng thử lại sau."})
                    elif 'not found' in err or '404' in err or '403' in err or 'permission' in err:
                        raise serializers.ValidationError({"model_name": f"Mô hình '{model_name}' bị chặn hoặc tài khoản của bạn chưa được cấp quyền dùng nó. Vui lòng chọn mô hình khác."})

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

    @action(detail=False, methods=['GET'])
    def available_providers(self, request):
        company = request.user.company
        settings, _ = CompanyAiSettings.objects.get_or_create(company=company)
        
        # Lấy các provider có key cá nhân đang active
        company_providers = list(CompanyAiKey.objects.filter(
            company=company, is_active=True
        ).values_list('provider', flat=True).distinct())
        
        # Nếu được phép dùng key hệ thống, lấy thêm các provider có key hệ thống đang active
        system_providers = []
        if settings.allow_system_keys and settings.use_system_keys:
            system_providers = list(SystemAiKey.objects.filter(
                is_active=True
            ).values_list('provider', flat=True).distinct())
            
        # Gộp lại và loại bỏ trùng lặp
        available = list(set(company_providers + system_providers))
        return Response({'available_providers': available})

    @action(detail=False, methods=['GET'])
    def fetch_models(self, request):
        """Gọi thẳng API của từng Provider để lấy danh sách model đang hỗ trợ."""
        provider = request.query_params.get('provider')
        if not provider:
            return Response({'error': 'Missing provider parameter'}, status=400)

        company = request.user.company
        from .services import get_api_keys
        keys = get_api_keys(company, provider)

        if not keys:
            return Response({'error': f'Không có API Key nào đang hoạt động cho nhà cung cấp "{provider}".'}, status=400)

        api_key = keys[0]
        models = []

        try:
            if provider == 'gemini':
                from google import genai as google_genai
                client = google_genai.Client(api_key=api_key)
                SKIP_KEYWORDS = ['tts', 'embed', 'aqa', 'imagen', 'veo', 'audio', 'live', 'translate', 'robotics', 'research', 'nano', 'lyria', 'omni', 'computer', 'antigravity', 'clip', 'image']
                for m in client.models.list():
                    name = m.name  # e.g. "models/gemini-2.5-flash"
                    # Only include text generation models
                    if hasattr(m, 'supported_actions') and m.supported_actions and 'generateContent' in m.supported_actions:
                        short_name = name.replace('models/', '')
                        if not any(kw in short_name.lower() for kw in SKIP_KEYWORDS):
                            models.append({'id': short_name, 'name': short_name})
                
                verified_models = models # Bỏ qua xác thực để tránh lỗi 429 Quota Exceeded
                
                models = verified_models

            elif provider == 'openai':
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                INCLUDE_PREFIXES = ('gpt-', 'o1', 'o2', 'o3', 'o4', 'chatgpt')
                for m in client.models.list():
                    if any(m.id.startswith(p) for p in INCLUDE_PREFIXES):
                        # Filter out fine-tuned or legacy models
                        if 'instruct' not in m.id and 'vision' not in m.id and '0301' not in m.id and '0314' not in m.id:
                            models.append({'id': m.id, 'name': m.id})
                
                verified_models = models # Bỏ qua xác thực để tránh lỗi 429 Quota Exceeded
                models = sorted(verified_models, key=lambda x: x['id'])

            elif provider == 'anthropic':
                # Anthropic doesn't have a public list endpoint, return known models
                models = [
                    {'id': 'claude-3-5-sonnet-20241022', 'name': 'Claude 3.5 Sonnet (Cân bằng)'},
                    {'id': 'claude-3-5-haiku-20241022', 'name': 'Claude 3.5 Haiku (Nhanh, Rẻ)'},
                    {'id': 'claude-opus-4-5', 'name': 'Claude Opus 4.5 (Thông minh nhất)'},
                    {'id': 'claude-sonnet-4-5', 'name': 'Claude Sonnet 4.5 (Thế hệ mới)'},
                ]
                
                # Bỏ qua xác thực để tránh lỗi 429 Quota Exceeded
                pass

        except Exception as e:
            return Response({'error': f'Lỗi khi kết nối tới {provider}: {str(e)}'}, status=400)

        # Mask API key for security
        masked_key = f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else "***"
        return Response({
            'models': models, 
            'count': len(models),
            'used_key': masked_key
        })
