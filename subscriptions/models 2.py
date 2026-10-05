import uuid
from django.db import models
from django.conf import settings


class SubscriptionPlan(models.Model):
    """Subscription plans - database-driven, not hard-coded."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    name = models.CharField(max_length=100)

    code = models.SlugField(unique=True)

    description = models.TextField(blank=True)

    monthly_price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    yearly_price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    max_members = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    max_storage_mb = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    max_projects = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    api_access = models.BooleanField(default=False)

    priority_support = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Subscription Plan"
        verbose_name_plural = "Subscription Plans"
        ordering = ['code']

    def __str__(self):
        return f"{self.name} ({self.code})"


class Subscription(models.Model):
    """Organization subscription model."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    organization = models.OneToOneField(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name="subscription"
    )

    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT
    )

    status = models.CharField(
        max_length=30,
        choices=[
            ("trialing", "Trialing"),
            ("active", "Active"),
            ("past_due", "Past Due"),
            ("cancelled", "Cancelled"),
            ("expired", "Expired"),
        ]
    )

    started_at = models.DateTimeField()

    current_period_start = models.DateTimeField()

    current_period_end = models.DateTimeField()

    cancelled_at = models.DateTimeField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Subscription"
        verbose_name_plural = "Subscriptions"


class PaymentProvider(models.Model):
    """Abstract base class for payment providers."""

    name = models.CharField(max_length=100)

    code = models.SlugField(max_length=100, unique=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Payment Provider"
        verbose_name_plural = "Payment Providers"

    def __str__(self):
        return self.name

    class Meta:
        abstract = True


class PaymentTransaction(models.Model):
    """Payment transaction model - provider-agnostic base."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name="payment_transactions"
    )

    provider = models.CharField(max_length=50)

    provider_transaction_id = models.CharField(max_length=255)

    amount = models.DecimalField(max_digits=12, decimal_places=2)

    currency = models.CharField(max_length=3)

    status = models.CharField(
        max_length=50,
        choices=[
            ("pending", "Pending"),
            ("completed", "Completed"),
            ("failed", "Failed"),
            ("refunded", "Refunded"),
        ]
    )

    kind = models.CharField(
        max_length=50,
        choices=[
            ("subscription", "Subscription"),
            ("setup", "Setup"),
            ("payment", "Payment"),
        ]
    )

    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Payment Transaction"
        verbose_name_plural = "Payment Transactions"


class SubscriptionEvent(models.Model):
    """Subscription event log for audit and tracking."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.SET_NULL,
        null=True
    )

    event_type = models.CharField(max_length=100)

    previous_status = models.CharField(max_length=30, null=True, blank=True)

    new_status = models.CharField(max_length=30, null=True, blank=True)

    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Subscription Event"
        verbose_name_plural = "Subscription Events"