"""Subscriptions API serializers."""

from subscriptions.models import Subscription, SubscriptionPlan, PaymentTransaction, SubscriptionEvent
from organizations.models import Organization
from rest_framework import serializers


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """Serializer for SubscriptionPlan model."""

    class Meta:
        model = SubscriptionPlan
        fields = [
            "id", "name", "code", "description",
            "monthly_price", "yearly_price",
            "max_members", "max_storage_mb", "max_projects",
            "api_access", "priority_support", "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for Subscription model."""

    plan_name = serializers.CharField(source="plan.name", read_only=True)
    plan_code = serializers.CharField(source="plan.code", read_only=True)
    organization_display = serializers.CharField(
        source="organization.display_name", read_only=True
    )

    class Meta:
        model = Subscription
        fields = [
            "id", "organization", "organization_display", "plan",
            "plan_name", "plan_code", "status",
            "started_at", "current_period_start", "current_period_end",
            "cancelled_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PaymentTransactionSerializer(serializers.ModelSerializer):
    """Serializer for PaymentTransaction model."""

    class Meta:
        model = PaymentTransaction
        fields = [
            "id", "organization", "provider", "provider_transaction_id",
            "amount", "currency", "status", "kind",
            "metadata", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SubscriptionEventSerializer(serializers.ModelSerializer):
    """Serializer for SubscriptionEvent model."""

    class Meta:
        model = SubscriptionEvent
        fields = [
            "id", "event_type", "previous_status", "new_status",
            "triggered_by", "metadata", "created_at",
        ]
        read_only_fields = "__all__"