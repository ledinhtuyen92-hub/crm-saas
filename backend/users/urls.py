from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ChangePasswordView,
    CompanyRegistrationView,
    CompanyViewSet,
    CurrentUserView,
    CustomTokenObtainPairView,
    PermissionViewSet,
    RoleViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register("companies", CompanyViewSet, basename="company")
router.register("roles", RoleViewSet, basename="role")
router.register("users", UserViewSet, basename="user")
router.register("permissions", PermissionViewSet, basename="permission")

urlpatterns = [
    # Auth
    path("login/", CustomTokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),

    # Profile
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),

    # Registration
    path("register-company/", CompanyRegistrationView.as_view(), name="register-company"),

    # Router (companies, roles, users, permissions)
    path("", include(router.urls)),
]
