"""URL configuration for common app API."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClinicalInsightViewSet

router = DefaultRouter()
router.register(r'insights', ClinicalInsightViewSet, basename='clinical-insight')

urlpatterns = [
    path('', include(router.urls)),
]