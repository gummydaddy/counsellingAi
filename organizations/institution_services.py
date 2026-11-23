"""Institution/Administration authentication and dashboard services."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from organizations.models import (
    Organization, InstitutionAdminProfile, InstitutionUserAssociation
)
from identity.models import User, LoginEvent

User = get_user_model()


class InstitutionAuthenticationError(Exception):
    """Exception raised for institution authentication errors."""
    pass


class InstitutionAuthService:
    """Service for institution/administration authentication."""

    @staticmethod
    def authenticate_institution_user(email, password):
        """
        Authenticate a user as an institution/administration admin.
        
        Returns (user, institution_admin_profile) tuple if successful,
        raises InstitutionAuthenticationError otherwise.
        """
        user = User.objects.filter(email=email).first()
        if not user:
            raise InstitutionAuthenticationError("Invalid credentials")
        
        if not user.is_active:
            raise InstitutionAuthenticationError("Account is inactive")

        # Check password using Django's authenticate
        from django.contrib.auth import authenticate
        authenticated_user = authenticate(request=None, username=email, password=password)
        if not authenticated_user:
            # Log failed login
            LoginEvent.objects.create(
                user=user,
                event_type="INSTITUTION_LOGIN_FAILED",
                metadata={"reason": "invalid_password"},
            )
            raise InstitutionAuthenticationError("Invalid credentials")

        # Check if user has an active institution admin profile
        try:
            admin_profile = InstitutionAdminProfile.objects.select_related("organization").get(
                user=user,
                status="active",
                organization__institution_type__in=["institute", "administration"],
                organization__institution_status="active",
            )
        except InstitutionAdminProfile.DoesNotExist:
            raise InstitutionAuthenticationError("No active institution access found for this account")

        # Log successful login
        LoginEvent.objects.create(
            user=user,
            event_type="INSTITUTION_LOGIN",
            metadata={
                "institution_id": str(admin_profile.organization.id),
                "institution_type": admin_profile.organization.institution_type,
                "role": admin_profile.role,
            },
        )

        return user, admin_profile

    @staticmethod
    def get_user_institution_profiles(user):
        """Get all active institution admin profiles for a user."""
        return InstitutionAdminProfile.objects.select_related("organization").filter(
            user=user,
            status="active",
            organization__institution_type__in=["institute", "administration"],
            organization__institution_status="active",
        )

    @staticmethod
    def create_institution_session(user, institution_profile, session_key, ip_address=None, user_agent=None):
        """Create a session for institution login."""
        from identity.models import UserSession

        key_hash = session_key[:40] if session_key else ""

        session = UserSession.objects.create(
            user=user,
            session_key_hash=key_hash,
            device_name=f"Institution: {institution_profile.organization.display_name}",
            ip_address=ip_address,
            user_agent=user_agent or "",
        )
        return session


class InstitutionDashboardService:
    """Service for institution/administration dashboard operations."""

    @staticmethod
    def get_dashboard_data(institution_admin_profile):
        """Get all dashboard data for an institution admin."""
        institution = institution_admin_profile.organization
        
        # Get associated users with pagination support
        associations = InstitutionUserAssociation.objects.select_related("user", "user__profile").filter(
            institution=institution,
            status="active"
        ).order_by("-created_at")

        # Get user count by association type
        user_counts = {}
        for assoc_type, _ in InstitutionUserAssociation._meta.get_field("association_type").choices:
            user_counts[assoc_type] = associations.filter(association_type=assoc_type).count()

        return {
            "institution": institution,
            "admin_profile": institution_admin_profile,
            "associations": associations,
            "user_counts": user_counts,
            "total_users": associations.count(),
        }

    @staticmethod
    def search_platform_users(query, institution, exclude_associated=True, limit=50):
        """Search for platform users to add to institution."""
        # Base queryset: active users
        users = User.objects.filter(is_active=True).select_related("profile")

        # Apply search filter
        if query:
            users = users.filter(
                Q(email__icontains=query) |
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(phone_number__icontains=query)
            )

        # Exclude already associated users
        if exclude_associated:
            associated_user_ids = InstitutionUserAssociation.objects.filter(
                institution=institution,
                status="active"
            ).values_list("user_id", flat=True)
            users = users.exclude(id__in=associated_user_ids)

        return users[:limit]

    @staticmethod
    @transaction.atomic
    def associate_user(institution, user, added_by, association_type="member", notes=""):
        """Associate a platform user with an institution."""
        # Check if already associated
        existing = InstitutionUserAssociation.objects.filter(
            institution=institution, user=user
        ).first()

        if existing:
            if existing.status == "active":
                raise ValueError("User is already associated with this institution")
            # Reactivate if inactive/archived
            existing.status = "active"
            existing.association_type = association_type
            existing.added_by = added_by
            existing.notes = notes
            existing.save()
            return existing

        # Create new association
        association = InstitutionUserAssociation.objects.create(
            institution=institution,
            user=user,
            association_type=association_type,
            added_by=added_by,
            notes=notes,
        )
        return association

    @staticmethod
    @transaction.atomic
    def remove_association(institution, user, removed_by):
        """Remove a user association from institution (soft delete)."""
        association = InstitutionUserAssociation.objects.filter(
            institution=institution, user=user, status="active"
        ).first()

        if not association:
            raise ValueError("User is not associated with this institution")

        association.status = "inactive"
        association.save()
        return association

    @staticmethod
    @transaction.atomic
    def update_association(institution, user, updated_by, association_type=None, notes=None):
        """Update an existing user association."""
        association = InstitutionUserAssociation.objects.filter(
            institution=institution, user=user, status="active"
        ).first()

        if not association:
            raise ValueError("User is not associated with this institution")

        if association_type is not None:
            association.association_type = association_type
        if notes is not None:
            association.notes = notes

        association.save()
        return association

    @staticmethod
    def get_associated_users(institution, association_type=None, status="active", page=1, page_size=50):
        """Get paginated list of associated users."""
        queryset = InstitutionUserAssociation.objects.select_related("user", "user__profile").filter(
            institution=institution
        )

        if status:
            queryset = queryset.filter(status=status)
        if association_type:
            queryset = queryset.filter(association_type=association_type)

        queryset = queryset.order_by("-created_at")

        # Pagination
        from django.core.paginator import Paginator
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)

        return {
            "associations": page_obj.object_list,
            "total": paginator.count,
            "page": page_obj.number,
            "pages": paginator.num_pages,
            "has_next": page_obj.has_next(),
            "has_previous": page_obj.has_previous(),
        }