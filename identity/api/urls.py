"""Identity API URLs."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = "identity"

router = DefaultRouter()
router.register(r"users", views.UserViewSet, basename="user")
router.register(r"profiles", views.UserProfileViewSet, basename="user-profile")
router.register(r"addresses", views.AddressViewSet, basename="address")
router.register(r"sessions", views.UserSessionViewSet, basename="user-session")
router.register(r"login-events", views.LoginEventViewSet, basename="login-event")

urlpatterns = [
    path("", include(router.urls)),
    path("token/", views.CustomTokenObtainPairView.as_view(), name="token_obtain"),
    path("token/refresh/", views.TokenRefreshView.as_view(), name="token_refresh"),
]