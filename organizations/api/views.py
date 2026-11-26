"""Organizations API views."""

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.contrib.auth import authenticate
from organizations.models import (
    Organization, OrganizationApplication, OrganizationProfile,
    OrganizationMembership, OrganizationRole,
    InstitutionAdminProfile, InstitutionUserAssociation
)
from .serializers import (
    OrganizationSerializer, OrganizationListSerializer,
    OrganizationApplicationSerializer, OrganizationMembershipSerializer,
    OrganizationRoleSerializer, OrganizationProfileSerializer,
    InstitutionAdminProfileSerializer, InstitutionUserAssociationSerializer,
    InstitutionLoginSerializer, InstitutionLoginResponseSerializer,
    InstitutionDashboardSerializer, UserSearchResultSerializer,
    AssociateUserSerializer,
    InstitutionSignupSerializer, InstitutionSignupResponseSerializer
)
from organizations.services import (
    OrganizationApplicationService, OrganizationApprovalService,
    OrganizationMembershipService, OrganizationAuthorizationService
)
from organizations.institution_services import (
    InstitutionAuthService, InstitutionDashboardService, InstitutionAuthenticationError
)
from identity.models import User
from rest_framework_simplejwt.tokens import RefreshToken


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


# Institution/Administration Authentication Views

class InstitutionLoginView(APIView):
    """Institution/Administration login endpoint."""
    
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = InstitutionLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        institution_id = serializer.validated_data.get("institution_id")

        try:
            user, admin_profile = InstitutionAuthService.authenticate_institution_user(email, password)

            # If institution_id provided, verify it matches
            if institution_id and str(admin_profile.organization.id) != str(institution_id):
                return Response(
                    {"error": "Invalid institution for this account"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # If user has multiple institution profiles, verify the correct one
            profiles = InstitutionAuthService.get_user_institution_profiles(user)
            if profiles.count() > 1 and not institution_id:
                return Response(
                    {
                        "error": "Multiple institution access found. Please specify institution_id.",
                        "institutions": InstitutionAdminProfileSerializer(profiles, many=True).data
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create JWT tokens
            refresh = RefreshToken.for_user(user)
            access = refresh.access_token

            # Add custom claims
            access["institution_id"] = str(admin_profile.organization.id)
            access["institution_type"] = admin_profile.organization.institution_type
            access["institution_role"] = admin_profile.role

            # Create session
            session_key = str(access)
            InstitutionAuthService.create_institution_session(
                user=user,
                institution_profile=admin_profile,
                session_key=session_key,
                ip_address=self._get_ip(request),
                user_agent=self._get_user_agent(request),
            )

            return Response(
                InstitutionLoginResponseSerializer({
                    "user": {
                        "id": str(user.id),
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "is_superuser": user.is_superuser,
                        "is_staff": user.is_staff,
                    },
                    "institution_admin_profile": admin_profile,
                    "access": str(access),
                    "refresh": str(refresh),
                }).data,
                status=status.HTTP_200_OK
            )

        except InstitutionAuthenticationError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_401_UNAUTHORIZED
            )

    def _get_ip(self, request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip

    def _get_user_agent(self, request):
        return request.META.get("HTTP_USER_AGENT", "")


class InstitutionSignupView(APIView):
    """Institution/Administration signup endpoint - creates organization application."""
    
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = InstitutionSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        
        # Check if user already exists
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        if User.objects.filter(email=data["email"]).exists():
            return Response(
                {"error": "A user with this email already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create user account
        user = User.objects.create_user(
            email=data["email"],
            phone_number=data.get("phone_number"),
            first_name=data["first_name"],
            last_name=data["last_name"],
        )
        user.set_password(data["password"])
        user.save()

        # Create organization application with institution_type
        application = OrganizationApplication.objects.create(
            applicant=user,
            legal_name=data["legal_name"],
            display_name=data["display_name"],
            organization_type=data["organization_type"],
            registration_number=data.get("registration_number", ""),
            description=data.get("description", ""),
        )
        
        # Set institution_type on the application for tracking
        # We'll store it in description or we need to add institution_type to OrganizationApplication model
        # For now, we'll include it in the description field or create a separate field
        
        # Log the signup event
        from identity.models import LoginEvent
        LoginEvent.objects.create(
            user=user,
            event_type="INSTITUTION_SIGNUP",
            metadata={
                "institution_type": data["institution_type"],
                "legal_name": data["legal_name"],
                "display_name": data["display_name"],
            },
        )

        return Response(
            InstitutionSignupResponseSerializer({
                "application": application,
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                },
                "message": "Institution signup successful. Your application is under review.",
            }).data,
            status=status.HTTP_201_CREATED
        )


class InstitutionDashboardView(APIView):
    """Institution/Administration dashboard endpoint."""
    
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get user's institution admin profiles
        profiles = InstitutionAuthService.get_user_institution_profiles(request.user)
        
        if not profiles.exists():
            return Response(
                {"error": "No active institution access found"},
                status=status.HTTP_403_FORBIDDEN
            )

        # If user has multiple, require institution_id query param
        institution_id = request.query_params.get("institution_id")
        if profiles.count() > 1 and not institution_id:
            return Response(
                {
                    "error": "Multiple institution access found. Please specify institution_id.",
                    "institutions": InstitutionAdminProfileSerializer(profiles, many=True).data
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get the specific profile
        if institution_id:
            admin_profile = profiles.filter(organization_id=institution_id).first()
            if not admin_profile:
                return Response(
                    {"error": "Institution access not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            admin_profile = profiles.first()

        # Check permissions
        if not admin_profile.can_manage_users:
            return Response(
                {"error": "Insufficient permissions to view dashboard"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get dashboard data
        dashboard_data = InstitutionDashboardService.get_dashboard_data(admin_profile)

        return Response(
            InstitutionDashboardSerializer(dashboard_data).data,
            status=status.HTTP_200_OK
        )


class InstitutionUserSearchView(APIView):
    """Search platform users to associate with institution."""
    
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get user's institution admin profile
        profiles = InstitutionAuthService.get_user_institution_profiles(request.user)
        
        institution_id = request.query_params.get("institution_id")
        if profiles.count() > 1 and not institution_id:
            return Response(
                {"error": "Please specify institution_id"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if institution_id:
            admin_profile = profiles.filter(organization_id=institution_id).first()
        else:
            admin_profile = profiles.first()

        if not admin_profile or not admin_profile.can_manage_users:
            return Response(
                {"error": "Insufficient permissions"},
                status=status.HTTP_403_FORBIDDEN
            )

        query = request.query_params.get("q", "")
        limit = int(request.query_params.get("limit", 50))

        users = InstitutionDashboardService.search_platform_users(
            query=query,
            institution=admin_profile.organization,
            exclude_associated=True,
            limit=limit
        )

        serializer = UserSearchResultSerializer(users, many=True)
        return Response(serializer.data)


class InstitutionAssociateUserView(APIView):
    """Associate a platform user with an institution."""
    
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Get user's institution admin profile
        profiles = InstitutionAuthService.get_user_institution_profiles(request.user)
        
        institution_id = request.data.get("institution_id")
        if profiles.count() > 1 and not institution_id:
            return Response(
                {"error": "Please specify institution_id"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if institution_id:
            admin_profile = profiles.filter(organization_id=institution_id).first()
        else:
            admin_profile = profiles.first()

        if not admin_profile or not admin_profile.can_manage_users:
            return Response(
                {"error": "Insufficient permissions"},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = AssociateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_id = serializer.validated_data["user_id"]
        association_type = serializer.validated_data["association_type"]
        notes = serializer.validated_data.get("notes", "")

        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            association = InstitutionDashboardService.associate_user(
                institution=admin_profile.organization,
                user=user,
                added_by=request.user,
                association_type=association_type,
                notes=notes
            )
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            InstitutionUserAssociationSerializer(association).data,
            status=status.HTTP_201_CREATED
        )


class InstitutionUserAssociationViewSet(viewsets.ViewSet):
    """ViewSet for managing institution user associations."""
    
    permission_classes = [IsAuthenticated]
    serializer_class = InstitutionUserAssociationSerializer

    def _get_admin_profile(self, request, institution_id=None):
        """Get the admin profile for the current user and institution."""
        profiles = InstitutionAuthService.get_user_institution_profiles(request.user)
        
        if profiles.count() > 1 and not institution_id:
            return None, "Please specify institution_id"
        
        if institution_id:
            admin_profile = profiles.filter(organization_id=institution_id).first()
        else:
            admin_profile = profiles.first()

        if not admin_profile:
            return None, "Institution access not found"
        
        if not admin_profile.can_manage_users:
            return None, "Insufficient permissions"
        
        return admin_profile, None

    def list(self, request):
        """List associated users with pagination."""
        institution_id = request.query_params.get("institution_id")
        admin_profile, error = self._get_admin_profile(request, institution_id)
        
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

        association_type = request.query_params.get("association_type")
        status_filter = request.query_params.get("status", "active")
        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 50))

        result = InstitutionDashboardService.get_associated_users(
            institution=admin_profile.organization,
            association_type=association_type,
            status=status_filter,
            page=page,
            page_size=page_size
        )

        serializer = self.serializer_class(result["associations"], many=True)
        return Response({
            "results": serializer.data,
            "total": result["total"],
            "page": result["page"],
            "pages": result["pages"],
            "has_next": result["has_next"],
            "has_previous": result["has_previous"],
        })

    def retrieve(self, request, pk=None):
        """Get a specific association."""
        institution_id = request.query_params.get("institution_id")
        admin_profile, error = self._get_admin_profile(request, institution_id)
        
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

        association = get_object_or_404(
            InstitutionUserAssociation,
            id=pk,
            institution=admin_profile.organization
        )
        serializer = self.serializer_class(association)
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        """Update an association (e.g., change type, add notes)."""
        institution_id = request.data.get("institution_id") or request.query_params.get("institution_id")
        admin_profile, error = self._get_admin_profile(request, institution_id)
        
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

        association = get_object_or_404(
            InstitutionUserAssociation,
            id=pk,
            institution=admin_profile.organization,
            status="active"
        )

        association_type = request.data.get("association_type")
        notes = request.data.get("notes")

        try:
            updated = InstitutionDashboardService.update_association(
                institution=admin_profile.organization,
                user=association.user,
                updated_by=request.user,
                association_type=association_type,
                notes=notes
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.serializer_class(updated)
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        """Remove a user association (soft delete)."""
        institution_id = request.data.get("institution_id") or request.query_params.get("institution_id")
        admin_profile, error = self._get_admin_profile(request, institution_id)
        
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

        association = get_object_or_404(
            InstitutionUserAssociation,
            id=pk,
            institution=admin_profile.organization,
            status="active"
        )

        try:
            InstitutionDashboardService.remove_association(
                institution=admin_profile.organization,
                user=association.user,
                removed_by=request.user
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_204_NO_CONTENT)


class AvailableOrganizationsView(APIView):
    """View for available organizations dropdown."""

    def get(self, request):
        """List organizations user can select."""
        from organizations.services import OrganizationAuthorizationService

        organizations = OrganizationAuthorizationService.get_approved_organizations()
        serializer = OrganizationListSerializer(organizations, many=True)
        return Response(serializer.data)