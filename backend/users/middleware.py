from django.http import JsonResponse
from .models import SystemSettings

class FileUploadLimitMiddleware:
    """
    Middleware kiểm tra dung lượng file tải lên.
    Nếu CONTENT_LENGTH vượt quá max_file_upload_mb từ SystemSettings,
    sẽ chặn request và trả về lỗi 413 Payload Too Large.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in ['POST', 'PUT', 'PATCH']:
            content_length = request.META.get('CONTENT_LENGTH')
            
            # Chỉ check nếu có gửi content_length và có vẻ như đang upload file (multipart/form-data)
            content_type = request.META.get('CONTENT_TYPE', '')
            if content_length and 'multipart/form-data' in content_type:
                try:
                    content_length = int(content_length)
                    settings = SystemSettings.load()
                    max_bytes = settings.max_file_upload_mb * 1024 * 1024
                    
                    if content_length > max_bytes:
                        return JsonResponse(
                            {'error': f'Kích thước file vượt quá giới hạn hệ thống ({settings.max_file_upload_mb} MB).'},
                            status=413
                        )
                except ValueError:
                    pass

        response = self.get_response(request)
        return response
