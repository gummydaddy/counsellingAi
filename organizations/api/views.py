"""Organizations API views."""

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.db import transaction
from organizations.models import (
    Organization, OrganizationApplication, OrganizationProfile,
    OrganizationMembership, OrganizationRole
)
from .serializers import (
    OrganizationSerializer, OrganizationListSerializer,
    OrganizationApplicationSerializer, OrganizationMembershipSerializer,
    OrganizationRoleSerializer, OrganizationProfileSerializer
)
from organizations.services import (
    OrganizationApplicationService, OrganizationApprovalService,
    OrganizationMembershipService, OrganizationAuthorizationService
)
from identity.models import User


class OrganizationViewSet(viewsets.ViewSet):
    """ViewSet for Organization model."""

    serializer_class = OrganizationSerializer

    def list(self, request):
        """List approved organizations available for selection."""
        organizations = Organization.objects.filter(status="approved")
        serializer = OrganizationListSerializer(organizations, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """Get organization details."""
        organization = get_object_or_404(Organization, pk=pk)
        serializer = self.serializer_class(organization)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="applications")
    def create_application(self, request):
        """Create an organization application."""
        from .services import OrganizationApplicationService

        serializer = OrganizationApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        application = OrganizationApplicationService.create_application(
            applicant=request.user,
            legal_name=serializer.validated_data["legal_name"],
            display_name=serializer.validated_data["display_name"],
            organization_type=serializer.validated_data["organization_type"],
            registration_number=serializer.validated_data.get("registration_number"),
            description=serializer.validated_data.get("description"),
        )

        return Response(
            OrganizationApplicationSerializer(application).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["get"], url_path="available")
    def available(self, request):
        """Get approved organizations available for selection."""
        organizations = OrganizationAuthorizationService.get_approved_organizations()
        serializer = OrganizationListSerializer(organizations, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="join")
    def join_organization(self, request, pk=None):
        """Join an approved organization."""
        from .services import OrganizationMembershipService

        organization = get_object_or_404(Organization, pk=pk)
        user = request.user

        # Check if user is already a member
        if OrganizationMembership.objects.filter(
                organization=organization, user=user, status="active"
        ).exists():
            return Response(
                {"error": "You are already a member of this organization."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check subscription limits
        from subscriptions.services import SubscriptionService
        if not SubscriptionService.can_add_member(
                organization, current_count=0, requested_count=1
        ):
            return Response(
                {"error": "Organization subscription limit reached."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Verify user is authorized
        is_member, membership, role = OrganizationAuthorizationService.check_membership(
            user, organization
        )
        if not is_member:
            return Response(
                {"error": "You are not authorized to join this organization."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Create membership - default to MEMBER role
        membership = OrganizationMembershipService.invite_user(
            organization=organization,
            invited_by=request.user,
            user=user,
            role_name="MEMBER"
        )

        # Accept the invitation automatically
        OrganizationMembershipService.accept_membership(membership.id, user)

        return Response(
            OrganizationMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        """List organization members."""
        organization = get_object_or_404(Organization, pk=pk)
        memberships = OrganizationMembership.objects.filter(
            organization=organization, status="active"
        )
        serializer = OrganizationMembershipSerializer(memberships, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="members/invite")
    def invite_member(self, request, pk=None):
        """Invite a user to join the organization."""
        organization = get_object_or_404(Organization, pk=pk)
        user = request.user

        from .services import OrganizationMembershipService

        email = request.data.get("email")
        role_name = request.data.get("role", "MEMBER")

        try:
            membership = OrganizationMembershipService.invite_user(
                organization=organization,
                invited_by=user,
                user__email=email,
                role_name=role_name
            )
            return Response(
                OrganizationMembershipSerializer(membership).data,
                status=status.HTTP_201_CREATED
            )
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=["patch"], url_path="members/<uuid:member_id>")
    def update_member(self, request, pk=None, member_id=None):
        """Update a member's role."""
        organization = get_object_or_404(Organization, pk=pk)
        user = request.user

        from .services import OrganizationMembershipService

        new_role_name = request.data.get("role")
        if not new_role_name:
            return Response(
                {"error": "Role is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            membership = OrganizationMembershipService.change_role(
                organization=organization,
                user=user,
                new_role_name=new_role_name,
                changed_by=user
            )
            return Response(
                OrganizationMembershipSerializer(membership).data,
                status=status.HTTP_200_OK
            )
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_403_FORBIDDEN
            )

    @action(detail=True, methods=["delete"], url_path="members/<uuid:member_id>")
    def remove_member(self, request, pk=None, member_id=None):
        """Remove a member from the organization."""
        organization = get_object_or_404(Organization, pk=pk)
        user = request.user

        from .services import OrganizationMembershipService

        try:
            OrganizationMembershipService.remove_member(
                organization=organization,
                user=user,
                removed_by=user
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_403_FORBIDDEN
            )


class OrganizationApplicationViewSet(viewsets.ViewSet):
    """ViewSet for OrganizationApplication model."""

    serializer_class = OrganizationApplicationSerializer

    def list(self, request):
        """List user's organization applications."""
        from .services import OrganizationApplicationService

        applications = OrganizationApplicationService.get_user_applications(request.user)
        serializer = self.serializer_class(applications, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """Approve an organization application (admin only)."""
        from .services import OrganizationApprovalService

        application = get_object_or_404(OrganizationApplication, pk=pk)
        approved_by = request.user

        organization = OrganizationApprovalService.approve_application(
            application.id, approved_by
        )

        return Response(
            OrganizationSerializer(organization).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        """Reject an organization application."""
        from .services import OrganizationApprovalService

        application = get_object_or_404(OrganizationApplication, pk=pk)
        reason = request.data.get("reason", "")

        application = OrganizationApprovalService.reject_application(
            application.id, request.user, reason
        )

        return Response(
            OrganizationApplicationSerializer(application).data,
            status=status.HTTP_200_OK
        )


class OrganizationMembershipViewSet(viewsets.ViewSet):
    """ViewSet for OrganizationMembership model."""

    serializer_class = OrganizationMembershipSerializer

    def list(self, request):
        """List organization members (admin only)."""
        organization = request.query_params.get("organization")
        if not organization:
            return Response(
                {"error": "Organization ID is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        memberships = OrganizationMembership.objects.filter(
            organization_id=organization, status="active"
        )
        serializer = self.serializer_class(memberships, many=True)
        return Response(serializer.data)


class OrganizationRoleViewSet(viewsets.ViewSet):
    """ViewSet for OrganizationRole model."""

    serializer_class = OrganizationRoleSerializer

    def list(self, request):
        """List organization roles."""
        from .services import OrganizationRoleService

        organization = request.query_params.get("organization")
        if organization:
            from organizations.models import OrganizationRole
            roles = OrganizationRole.objects.filter(organization_id=organization)
        else:
            roles = OrganizationRole.objects.filter(is_system_role=True)
        serializer = self.serializer_class(roles, many=True)
        return Response(serializer.data)


class OrganizationProfileViewSet(viewsets.ViewSet):
    """ViewSet for OrganizationProfile model."""

    serializer_class = OrganizationProfileSerializer

    def retrieve(self, request, pk=None):
        """Get organization profile."""
        from organizations.models import Organization
        organization = get_object_or_404(Organization, pk=pk)
        profile = organization.profile
        serializer = self.serializer_class(profile)
        return Response(serializer.data)

    @action(detail=True, methods=["patch"])
    def update_profile(self, request, pk=None):
        """Update organization profile."""
        from organizations.models import Organization
        organization = get_object_or_404(Organization, pk=pk)
        profile = organization.profile
        serializer = self.serializer_class(
            profile, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


class AvailableOrganizationsView(APIView):
    """View for available organizations dropdown."""

    def get(self, request):
        """List organizations user can select."""
        from organizations.services import OrganizationAuthorizationService

        organizations = OrganizationAuthorizationService.get_approved_organizations()
        serializer = OrganizationListSerializer(organizations, many=True)
        return Response(serializer.data)