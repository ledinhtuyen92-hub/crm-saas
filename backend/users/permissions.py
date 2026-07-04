from rest_framework.permissions import BasePermission


class IsActiveUserAndCompany(BasePermission):
    """
    Đảm bảo user đang hoạt động và công ty của user cũng đang hoạt động (nếu có).
    Nếu công ty bị khoá, chặn tất cả request API.
    """
    message = "Tài khoản của bạn hoặc công ty đã bị khoá/vô hiệu hóa."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if not user.is_active:
            return False
            
        if user.company and not user.company.is_active:
            return False
            
        return True


class IsSuperAdmin(BasePermission):
    """Chỉ cho phép System Administrator (is_superuser=True)."""

    message = "Bạn phải là Quản trị viên hệ thống để thực hiện hành động này."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsCompanyAdmin(BasePermission):
    """Cho phép Company Admin (is_company_admin=True) hoặc System Admin."""

    message = "Bạn phải là Quản trị viên công ty để thực hiện hành động này."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser or request.user.is_company_admin)
        )


class IsCompanyAdminOrReadOnly(BasePermission):
    """Company Admin có toàn quyền; nhân viên thường chỉ đọc."""

    message = "Bạn không có quyền thực hiện thao tác này."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return request.user.is_superuser or request.user.is_company_admin


class HasModulePermission(BasePermission):
    """
    Kiểm tra xem user có permission code yêu cầu trong role.permissions không.
    Sử dụng bằng cách gán `required_permission` vào view:

        class MyView(APIView):
            permission_classes = [IsAuthenticated, HasModulePermission]
            required_permission = 'crm.view'
    """

    message = "Bạn không có quyền truy cập module này."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        # Superuser và company admin luôn có tất cả quyền
        if request.user.is_superuser or request.user.is_company_admin:
            return True
        required = getattr(view, "required_permission", None)
        if not required:
            return True
        if not request.user.role:
            return False
        return request.user.role.permissions.filter(code=required).exists()
