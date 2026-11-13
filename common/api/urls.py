"""URL configuration for common app API."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClinicalInsightViewSet, CounsellingSessionViewSet

router = DefaultRouter()
router.register(r'insights', ClinicalInsightViewSet, basename='clinical-insight')
router.register(r'sessions', CounsellingSessionViewSet, basename='counselling-session')

urlpatterns = [
    path('', include(router.urls)),
]