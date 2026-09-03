"""Seed management command for the identity system."""

from django.core.management.base import BaseCommand
from django.db import transaction
from subscriptions.models import SubscriptionPlan
from organizations.models import OrganizationRole


class Command(BaseCommand):
    help = "Seed the identity system with default subscription plans and organization roles."

    def handle(self, *args, **options):
        self.stdout.write("Seeding identity system...")

        with transaction.atomic():
            # Create subscription plans
            plans_data = [
                {
                    "name": "FREE",
                    "code": "free",
                    "description": "Free plan for individual users",
                    "monthly_price": 0.00,
                    "yearly_price": 0.00,
                    "max_members": 1,
                    "max_storage_mb": 100,
                    "max_projects": 1,
                    "api_access": False,
                    "priority_support": False,
                },
                {
                    "name": "BASIC",
                    "code": "basic",
                    "description": "Basic plan for small teams",
                    "monthly_price": 9.99,
                    "yearly_price": 99.99,
                    "max_members": 5,
                    "max_storage_mb": 1000,
                    "max_projects": 3,
                    "api_access": True,
                    "priority_support": False,
                },
                {
                    "name": "PRO",
                    "code": "pro",
                    "description": "Pro plan for growing teams",
                    "monthly_price": 19.99,
                    "yearly_price": 199.99,
                    "max_members": 20,
                    "max_storage_mb": 10000,
                    "max_projects": 10,
                    "api_access": True,
                    "priority_support": True,
                },
                {
                    "name": "BUSINESS",
                    "code": "business",
                    "description": "Business plan for established businesses",
                    "monthly_price": 49.99,
                    "yearly_price": 499.99,
                    "max_members": 100,
                    "max_storage_mb": 100000,
                    "max_projects": 50,
                    "api_access": True,
                    "priority_support": True,
                },
                {
                    "name": "ENTERPRISE",
                    "code": "enterprise",
                    "description": "Enterprise plan for large organizations",
                    "monthly_price": 99.99,
                    "yearly_price": 999.99,
                    "max_members": None,
                    "max_storage_mb": None,
                    "max_projects": None,
                    "api_access": True,
                    "priority_support": True,
                },
            ]

            for plan_data in plans_data:
                plan, created = SubscriptionPlan.objects.get_or_create(
                    code=plan_data["code"],
                    defaults=plan_data,
                )
                if created:
                    self.stdout.write(f"  Created plan: {plan.name}")
                else:
                    self.stdout.write(f"  Plan already exists: {plan.name}")

            # Create system roles
            roles_data = [
                {"name": "OWNER", "code": "owner", "description": "Organization owner", "is_system_role": True},
                {"name": "ADMIN", "code": "admin", "description": "Organization administrator", "is_system_role": True},
                {"name": "MANAGER", "code": "manager", "description": "Organization manager", "is_system_role": True},
                {"name": "MEMBER", "code": "member", "description": "Organization member", "is_system_role": True},
                {"name": "VIEWER", "code": "viewer", "description": "Organization viewer", "is_system_role": True},
            ]

            for role_data in roles_data:
                role, created = OrganizationRole.objects.get_or_create(
                    code=role_data["code"],
                    defaults=role_data,
                )
                if created:
                    self.stdout.write(f"  Created role: {role.name}")
                else:
                    self.stdout.write(f"  Role already exists: {role.name}")

        self.stdout.write("Identity system seeded successfully.")