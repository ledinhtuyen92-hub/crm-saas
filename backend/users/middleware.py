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


class MaintenanceModeMiddleware:
    """
    Middleware kiểm tra chế độ bảo trì dữ liệu toàn hệ thống.
    Khi maintenance_mode=True, mọi thao tác POST/PUT/PATCH/DELETE
    đều bị chặn trả về 403 (trừ tài khoản System Superuser hoặc các endpoint auth).
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            # Bỏ qua các endpoint đăng nhập, làm mới token
            path = request.path.lower()
            if '/login/' in path or '/token/refresh/' in path:
                return self.get_response(request)

            try:
                settings = SystemSettings.load()
                if settings.maintenance_mode:
                    # Kiểm tra xem user có phải superuser không thông qua JWT authentication
                    from rest_framework_simplejwt.authentication import JWTAuthentication
                    auth = JWTAuthentication()
                    try:
                        user_auth_tuple = auth.authenticate(request)
                        if user_auth_tuple and user_auth_tuple[0].is_superuser:
                            return self.get_response(request)
                    except Exception:
                        pass

                    return JsonResponse(
                        {'detail': '⚠️ Hệ thống đang bảo trì dữ liệu. Các chức năng thêm, sửa, xóa dữ liệu tạm thời bị khóa để bảo trì kỹ thuật!'},
                        status=403
                    )
            except Exception:
                pass

        return self.get_response(request)

