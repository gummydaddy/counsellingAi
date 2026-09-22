"""Organization service - business logic for organization operations."""

from django.db import transaction
from django.contrib.auth import get_user_model
from .models import Organization, OrganizationApplication, OrganizationProfile, OrganizationMembership, OrganizationRole

User = get_user_model()


class OrganizationApplicationService:

    @staticmethod
    def create_application(applicant, legal_name, display_name, organization_type,
                           registration_number=None, description=None):
        """Create a new organization application."""
        application = OrganizationApplication.objects.create(
            applicant=applicant,
            legal_name=legal_name,
            display_name=display_name,
            organization_type=organization_type,
            registration_number=registration_number,
            description=description,
        )
        return application

    @staticmethod
    def get_user_applications(user):
        """Get all applications for a user."""
        return OrganizationApplication.objects.filter(applicant=user)

    @staticmethod
    def get_pending_applications():
        """Get all pending organization applications."""
        return OrganizationApplication.objects.filter(status="pending")

    @staticmethod
    def get_approved_organizations():
        """Get all approved organizations."""
        return Organization.objects.filter(status="approved")


class OrganizationApprovalService:

    @staticmethod
    @transaction.atomic
    def approve_application(application_id, approved_by):
        """Approve an organization application and create the organization."""
        from .models import Organization

        application = OrganizationApplication.objects.get(id=application_id)

        if application.status != "pending":
            raise ValueError("Only pending applications can be approved.")

        # Update application status
        application.status = "approved"
        application.reviewed_by = approved_by
        application.reviewed_at = transaction.now()
        application.save()

        # Create organization
        organization = Organization.objects.create(
            legal_name=application.legal_name,
            display_name=application.display_name,
            organization_type=application.organization_type,
            registration_number=application.registration_number,
            created_by=application.applicant,
            approved_by=approved_by,
            approved_at=transaction.now(),
        )

        # Create organization profile
        OrganizationProfile.objects.create(organization=organization)

        # Create owner membership
        owner_role, _ = OrganizationRole.objects.get_or_create(
            name="OWNER",
            code="owner",
            defaults={"description": "Organization owner", "is_system_role": True},
        )

        OrganizationMembership.objects.create(
            organization=organization,
            user=application.applicant,
            role=owner_role,
            status="active",
        )

        # Assign default FREE subscription
        from subscriptions.models import SubscriptionPlan
        default_plan = SubscriptionPlan.objects.get(code="free")
        Subscription.objects.create(
            organization=organization,
            plan=default_plan,
            status="active",
            started_at=transaction.now(),
            current_period_start=transaction.now(),
            current_period_end=transaction.now(),
        )

        # Log audit event
        from audit.models import AuditEvent
        AuditEvent.objects.create(
            actor=approved_by,
            organization=organization,
            event_type="ORGANIZATION_APPROVED",
            target_type="organization",
            target_id=organization.id,
            metadata={
                "application_id": str(application.id),
                "approved_by": str(approved_by.id),
            },
        )

        return organization

    @staticmethod
    def reject_application(application_id, rejected_by, reason=""):
        """Reject an organization application."""
        application = OrganizationApplication.objects.get(id=application_id)

        if application.status != "pending":
            raise ValueError("Only pending applications can be rejected.")

        application.status = "rejected"
        application.rejection_reason = reason
        application.reviewed_by = rejected_by
        application.reviewed_at = transaction.now()
        application.save()

        # Log audit event
        from audit.models import AuditEvent
        AuditEvent.objects.create(
            actor=rejected_by,
            organization=None,
            event_type="ORGANIZATION_REJECTED",
            target_type="organization_application",
            target_id=application.id,
            metadata={
                "application_id": str(application.id),
                "rejected_by": str(rejected_by.id),
                "reason": reason,
            },
        )

        return application

    @staticmethod
    def suspend_organization(organization_id, suspended_by):
        """Suspend an organization."""
        from .models import Organization

        organization = Organization.objects.get(id=organization_id)
        organization.status = "suspended"
        organization.save()

        # Log audit event
        from audit.models import AuditEvent
        AuditEvent.objects.create(
            actor=suspended_by,
            organization=organization,
            event_type="ORGANIZATION_SUSPENDED",
            target_type="organization",
            target_id=organization.id,
            metadata={
                "suspended_by": str(suspended_by.id),
            },
        )

        return organization


class OrganizationMembershipService:

    @staticmethod
    @transaction.atomic
    def invite_user(organization, invited_by, user, role_name="MEMBER"):
        """Invite a user to join an organization."""
        from .models import OrganizationRole

        # Get or create the role
        role, _ = OrganizationRole.objects.get_or_create(
            name=role_name,
            code=role_name.lower(),
            defaults={"description": f"{role_name} role", "is_system_role": True},
        )

        # Check if user is already a member
        if OrganizationMembership.objects.filter(
                organization=organization, user=user
        ).exists():
            raise ValueError("User is already a member of this organization.")

        membership = OrganizationMembership.objects.create(
            organization=organization,
            user=user,
            role=role,
            status="invited",
        )

        return membership

    @staticmethod
    @transaction.atomic
    def accept_membership(membership_id, user):
        """Accept a membership invitation."""
        membership = OrganizationMembership.objects.get(
            id=membership_id, user=user, status="invited"
        )
        membership.status = "active"
        membership.save()
        return membership

    @staticmethod
    def remove_member(organization, user, removed_by):
        """Remove a member from an organization."""
        membership = OrganizationMembership.objects.filter(
            organization=organization, user=user
        ).first()

        if not membership:
            raise ValueError("User is not a member of this organization.")

        membership.status = "removed"
        membership.save()

        return membership

    @staticmethod
    def change_role(organization, user, new_role_name, changed_by):
        """Change a user's role in an organization."""
        membership = OrganizationMembership.objects.filter(
            organization=organization, user=user
        ).first()

        if not membership:
            raise ValueError("User is not a member of this organization.")

        from .models import OrganizationRole
        new_role, _ = OrganizationRole.objects.get_or_create(
            name=new_role_name,
            code=new_role_name.lower(),
            defaults={"description": f"{new_role_name} role", "is_system_role": True},
        )

        membership.role = new_role
        membership.save()
        return membership


class OrganizationAuthorizationService:

    @staticmethod
    def check_membership(user, organization, required_role=None):
        """Check if user is an active member of organization.

        Returns (is_member, membership, role) tuple.
        """
        from .models import OrganizationMembership

        try:
            membership = OrganizationMembership.objects.get(
                organization=organization,
                user=user,
                status="active",
            )
        except OrganizationMembership.DoesNotExist:
            return False, None, None

        if required_role and membership.role.name != required_role:
            return True, membership, membership.role

        return True, membership, membership.role

    @staticmethod
    def check_organization_owner(user, organization):
        """Check if user is the organization owner."""
        from .models import OrganizationMembership

        return OrganizationMembership.objects.filter(
            organization=organization,
            user=user,
            role__name="OWNER",
            status="active",
        ).exists()

    @staticmethod
    def check_permission(user, organization, permission_codename):
        """Check if user has a specific permission in organization.

        permission_codename examples: 'organization.view', 'member.invite', etc.
        """
        is_member, membership, role = OrganizationAuthorizationService.check_membership(
            user, organization
        )

        if not is_member:
            return False

        # Define permission mapping
        permission_map = {
            "organization.view": True,  # Any member can view
            "organization.update": (
                membership.role.name in ["OWNER", "ADMIN"]
            ),
            "organization.delete": (
                membership.role.name == "OWNER"
            ),
            "member.invite": (
                membership.role.name in ["OWNER", "ADMIN"]
            ),
            "member.remove": (
                membership.role.name in ["OWNER", "ADMIN"]
            ),
            "member.update": (
                membership.role.name in ["OWNER", "ADMIN", "MANAGER"]
            ),
            "subscription.manage": (
                membership.role.name in ["OWNER", "ADMIN"]
            ),
        }

        return permission_map.get(permission_codename, False)