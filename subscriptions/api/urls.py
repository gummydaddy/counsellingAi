"""Subscriptions API URLs."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = "subscriptions"

router = DefaultRouter()
router.register(r"plans", views.SubscriptionPlanViewSet, basename="plan")
router.register(r"subscriptions", views.SubscriptionViewSet, basename="subscription")

urlpatterns = [
    path("", include(router.urls)),
]