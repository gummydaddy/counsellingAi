"""Permission classes for organization operations."""

from rest_framework import permissions
from .models import OrganizationMembership


class IsOrganizationMember(permissions.BasePermission):
    """Check if user is an active member of the organization."""

    def has_permission(self, request, view):
        organization_id = self._get_organization_id(view, request)
        if not organization_id:
            return False

        user = request.user
        if not user.is_authenticated:
            return False

        membership = OrganizationMembership.objects.filter(
            organization_id=organization_id,
            user=user,
            status="active",
        ).first()

        return membership is not None

    def _get_organization_id(self, view, request):
        """Extract organization ID from view or request."""
        # Try URL keyword argument
        organization_id = None
        if hasattr(view, 'kwargs') and 'organization_id' in view.kwargs:
            organization_id = view.kwargs['organization_id']
        # Try header
        elif request.headers.get('X-Organization-ID'):
            organization_id = request.headers.get('X-Organization-ID')
        return organization_id

    message "You must be a member of this organization to perform this action."


class IsOrganizationAdmin(IsOrganizationMember):
    """Check if user is an organization admin or owner."""

    def has_permission(self, request, view):
        organization_id = self._get_organization_id(view, request)
        if not super().has_permission(request, view):
            return False

        from .models import OrganizationMembership
        membership = OrganizationMembership.objects.filter(
            organization_id=organization_id,
            user=request.user,
            status="active",
        ).first()

        if not membership:
            return False

        return membership.role.name in ["OWNER", "ADMIN"]

    message "You must be an organization admin to perform this action."


class IsOrganizationOwner(IsOrganizationAdmin):
    """Check if user is the organization owner."""

    def has_permission(self, request, view):
        organization_id = self._get_organization_id(view, request)
        if not super().has_permission(request, view):
            return False

        from .models import OrganizationMembership
        return OrganizationMembership.objects.filter(
            organization_id=organization_id,
            user=request.user,
            role__name="OWNER",
            status="active",
        ).exists()

    message "You must be the organization owner to perform this action."


class CanManageMembers(IsOrganizationAdmin):
    """Check if user can manage organization members."""

    message "You must be an organization admin to manage members."


class CanManageSubscription(IsOrganizationAdmin):
    """Check if user can manage organization subscription."""

    message "You must be an organization admin to manage subscription."