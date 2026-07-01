from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CompanyRegistrationView, PermissionViewSet, RoleViewSet, UserViewSet

router = DefaultRouter()
router.register("roles", RoleViewSet, basename="role")
router.register("users", UserViewSet, basename="user")
router.register("permissions", PermissionViewSet, basename="permission")

urlpatterns = [
    path("register-company/", CompanyRegistrationView.as_view(), name="register-company"),
    path("", include(router.urls)),
]
