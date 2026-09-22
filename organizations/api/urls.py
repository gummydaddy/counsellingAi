"""Organizations API URLs."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = "organizations"

router = DefaultRouter()
router.register(r"organizations", views.OrganizationViewSet, basename="organization")
router.register(r"applications", views.OrganizationApplicationViewSet, basename="organization-application")
router.register(r"memberships", views.OrganizationMembershipViewSet, basename="organization-membership")
router.register(r"roles", views.OrganizationRoleViewSet, basename="organization-role")
router.register(r"profiles", views.OrganizationProfileViewSet, basename="organization-profile")

urlpatterns = [
    path("", include(router.urls)),
    path("available/", views.AvailableOrganizationsView.as_view(), name="available-organizations"),
]