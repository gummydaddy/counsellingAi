"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
"""

from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect


def redirect_to_frontend(request):
    return redirect("https://test.counsel.socyfie.com")


urlpatterns = [
    path('', redirect_to_frontend, name='home'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('identity.api.urls')),
    path('api/organizations/', include('organizations.api.urls')),
    path('api/subscriptions/', include('subscriptions.api.urls')),
    path('api/common/', include('common.api.urls')),
]