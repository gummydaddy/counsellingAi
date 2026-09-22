"""Subscription service - business logic for subscription operations."""

from django.db import transaction
from .models import Subscription, SubscriptionPlan


class SubscriptionService:

    @staticmethod
    def get_organization_subscription(organization):
        """Get an organization's subscription."""
        return organization.subscription

    @staticmethod
    def can_add_member(organization, current_count=0, requested_count=1):
        """Check if organization can add more members based on plan limits."""
        subscription = organization.subscription
        plan = subscription.plan

        if plan.max_members is None:
            return True  # Unlimited members

        max_allowed = plan.max_members
        current_members = current_count + 1  # +1 for the new member
        return current_members <= max_allowed

    @staticmethod
    def can_use_api(organization):
        """Check if organization can use API access based on plan."""
        subscription = organization.subscription
        plan = subscription.plan
        return plan.api_access

    @staticmethod
    def can_use_storage(organization, requested_mb):
        """Check if organization has enough storage based on plan."""
        subscription = organization.subscription
        plan = subscription.plan

        if plan.max_storage_mb is None:
            return True  # Unlimited storage

        current_used = subscription.metadata.get('storage_used_mb', 0) if subscription.metadata else 0
        total_needed = current_used + requested_mb
        return total_needed <= plan.max_storage_mb

    @staticmethod
    def can_create_project(organization):
        """Check if organization can create projects based on plan."""
        subscription = organization.subscription
        plan = subscription.plan

        if plan.max_projects is None:
            return True  # Unlimited projects

        current_projects = subscription.metadata.get('projects_count', 0) if subscription.metadata else 0
        return current_projects < plan.max_projects

    @staticmethod
    @transaction.atomic
    def upgrade_subscription(organization, new_plan_code):
        """Upgrade organization subscription to a new plan."""
        from .models import SubscriptionPlan

        new_plan = SubscriptionPlan.objects.get(code=new_plan_code)
        subscription = organization.subscription

        subscription.plan = new_plan
        subscription.save()

        # Log audit event
        from audit.models import AuditEvent
        from identity.services import AuditService
        AuditService.log_event(
            actor=None,
            organization=organization,
            event_type="SUBSCRIPTION_CHANGED",
            target_type="subscription",
            target_id=subscription.id,
            metadata={
                "previous_plan": subscription.plan.code,
                "new_plan": new_plan.code,
            },
        )

        return subscription

    @staticmethod
    @transaction.atomic
    def cancel_subscription(organization, cancelled_by):
        """Cancel organization subscription."""
        subscription = organization.subscription
        subscription.status = "cancelled"
        subscription.cancelled_at = transaction.now()
        subscription.save()

        # Log audit event
        from audit.models import AuditEvent
        from identity.services import AuditService
        AuditService.log_event(
            actor=cancelled_by,
            organization=organization,
            event_type="SUBSCRIPTION_CANCELLED",
            target_type="subscription",
            target_id=subscription.id,
            metadata={
                "cancelled_by": str(cancelled_by.id),
            },
        )

        return subscription

    @staticmethod
    def get_effective_limits(organization):
        """Get effective limits for an organization based on its plan."""
        subscription = organization.subscription
        plan = subscription.plan

        limits = {
            "max_members": plan.max_members,
            "max_storage_mb": plan.max_storage_mb,
            "max_projects": plan.max_projects,
            "api_access": plan.api_access,
            "priority_support": plan.priority_support,
        }

        return limits