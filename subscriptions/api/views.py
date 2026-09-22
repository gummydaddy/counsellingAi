"""Subscriptions API views."""

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.db import transaction
from subscriptions.models import Subscription, SubscriptionPlan, PaymentTransaction, SubscriptionEvent
from organizations.models import Organization
from subscriptions.services import SubscriptionService
from .serializers import (
    SubscriptionPlanSerializer, SubscriptionSerializer,
    PaymentTransactionSerializer, SubscriptionEventSerializer
)


class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for SubscriptionPlan model (read-only)."""

    queryset = SubscriptionPlan.objects.filter(is_active=True)
    serializer_class = SubscriptionPlanSerializer
    permission_classes = []


class SubscriptionViewSet(viewsets.ViewSet):
    """ViewSet for Subscription model."""

    serializer_class = SubscriptionSerializer
    permission_classes = []

    def retrieve(self, request, organization_id=None):
        """Get organization subscription."""
        organization = get_object_or_404(Organization, pk=organization_id)
        subscription = organization.subscription
        serializer = self.serializer_class(subscription)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="organization/(?P<organization_id>[^/.]+)")
    def organization_subscription(self, request, organization_id=None):
        """Get organization subscription by organization ID."""
        return self.retrieve(request, organization_id=organization_id)

    @action(detail=True, methods=["post"], url_path="change")
    def change(self, request, pk=None):
        """Change subscription plan."""
        organization = get_object_or_404(Organization, pk=pk)
        new_plan_code = request.data.get("plan_code")

        if not new_plan_code:
            return Response(
                {"error": "Plan code is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            subscription = SubscriptionService.upgrade_subscription(
                organization, new_plan_code
            )
            return Response(
                SubscriptionSerializer(subscription).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Cancel organization subscription."""
        organization = get_object_or_404(Organization, pk=pk)
        cancelled_by = request.user

        try:
            subscription = SubscriptionService.cancel_subscription(
                organization, cancelled_by
            )
            return Response(
                SubscriptionSerializer(subscription).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class PaymentTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for PaymentTransaction model (read-only)."""

    queryset = PaymentTransaction.objects.all()
    serializer_class = PaymentTransactionSerializer
    permission_classes = []


class SubscriptionEventViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for SubscriptionEvent model (read-only)."""

    queryset = SubscriptionEvent.objects.all()
    serializer_class = SubscriptionEventSerializer
    permission_classes = []