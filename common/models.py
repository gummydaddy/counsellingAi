"""Common utilities and constants for the project."""
import uuid
from django.db import models
from django.conf import settings


# Organization status constants
ORG_STATUS_PENDING = "pending"
ORG_STATUS_APPROVED = "approved"
ORG_STATUS_REJECTED = "rejected"
ORG_STATUS_SUSPENDED = "suspended"
ORG_STATUS_ARCHIVED = "archived"

# Organization membership status
MEMBERSHIP_STATUS_INVITED = "invited"
MEMBERSHIP_STATUS_ACTIVE = "active"
MEMBERSHIP_STATUS_SUSPENDED = "suspended"
MEMBERSHIP_STATUS_REMOVED = "removed"

# Membership roles
ROLE_OWNER = "OWNER"
ROLE_ADMIN = "ADMIN"
ROLE_MANAGER = "MANAGER"
ROLE_MEMBER = "MEMBER"
ROLE_VIEWER = "VIEWER"

# Subscription status
SUBSCRIPTION_STATUS_TRIALING = "trialing"
SUBSCRIPTION_STATUS_ACTIVE = "active"
SUBSCRIPTION_STATUS_PAST_DUE = "past_due"
SUBSCRIPTION_STATUS_CANCELLED = "cancelled"
SUBSCRIPTION_STATUS_EXPIRED = "expired"

# Application status
APPLICATION_STATUS_PENDING = "pending"
APPLICATION_STATUS_UNDER_REVIEW = "under_review"
APPLICATION_STATUS_APPROVED = "approved"
APPLICATION_STATUS_REJECTED = "rejected"


# Permission codenames
VIEW_ORGANIZATION = "organization.view"
UPDATE_ORGANIZATION = "organization.update"
DELETE_ORGANIZATION = "organization.delete"
INVITE_MEMBER = "member.invite"
REMOVE_MEMBER = "member.remove"
UPDATE_MEMBER = "member.update"
VIEW_SUBSCRIPTION = "subscription.view"
MANAGE_SUBSCRIPTION = "subscription.manage"


def get_organization_choices():
    """Return organization status choices."""
    return [
        (ORG_STATUS_PENDING, "Pending"),
        (ORG_STATUS_APPROVED, "Approved"),
        (ORG_STATUS_REJECTED, "Rejected"),
        (ORG_STATUS_SUSPENDED, "Suspended"),
        (ORG_STATUS_ARCHIVED, "Archived"),
    ]


def get_membership_status_choices():
    """Return membership status choices."""
    return [
        (MEMBERSHIP_STATUS_INVITED, "Invited"),
        (MEMBERSHIP_STATUS_ACTIVE, "Active"),
        (MEMBERSHIP_STATUS_SUSPENDED, "Suspended"),
        (MEMBERSHIP_STATUS_REMOVED, "Removed"),
    ]


def get_subscription_status_choices():
    """Return subscription status choices."""
    return [
        (SUBSCRIPTION_STATUS_TRIALING, "Trialing"),
        (SUBSCRIPTION_STATUS_ACTIVE, "Active"),
        (SUBSCRIPTION_STATUS_PAST_DUE, "Past Due"),
        (SUBSCRIPTION_STATUS_CANCELLED, "Cancelled"),
        (SUBSCRIPTION_STATUS_EXPIRED, "Expired"),
    ]


class Address(models.Model):
    """Precise user address/location information."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="addresses"
    )

    address_type = models.CharField(
        max_length=30,
        choices=[
            ("home", "Home"),
            ("work", "Work"),
            ("billing", "Billing"),
            ("shipping", "Shipping"),
            ("other", "Other"),
        ]
    )

    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(
        max_length=255,
        blank=True
    )

    landmark = models.CharField(
        max_length=255,
        blank=True
    )

    locality = models.CharField(max_length=150)
    city = models.CharField(max_length=150)
    district = models.CharField(
        max_length=150,
        blank=True
    )

    state = models.CharField(max_length=150)
    postal_code = models.CharField(max_length=32)

    country = models.CharField(max_length=2)

    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True
    )

    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True
    )

    geocoded = models.BooleanField(default=False)

    is_primary = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Address"
        verbose_name_plural = "Addresses"

    def __str__(self):
        return f"{self.address_line_1}, {self.city}, {self.country}"


class ClinicalInsight(models.Model):
    """Clinical insights learned from sessions - with pgvector embeddings for semantic search."""
    
    SESSION_TYPES = [
        ('school', 'School'),
        ('medical', 'Medical'),
        ('psychological', 'Psychological'),
        ('career', 'Career'),
        ('relationship', 'Relationship'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    session_type = models.CharField(max_length=20, choices=SESSION_TYPES, db_index=True)
    pattern = models.TextField()
    recommendation = models.TextField()
    
    # pgvector embedding for semantic similarity search
    # 1536 dimensions for OpenAI ada-002, 768 for others
    embedding = models.BinaryField(null=True, blank=True)  # Store as raw bytes for pgvector
    
    # Metadata
    confidence_score = models.FloatField(default=0.0)
    usage_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Clinical Insight"
        verbose_name_plural = "Clinical Insights"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['session_type', '-created_at']),
            models.Index(fields=['confidence_score']),
        ]
    
    def __str__(self):
        return f"[{self.session_type}] {self.pattern[:50]}..."
    
    def set_embedding(self, vector: list[float]):
        """Store embedding as binary for pgvector."""
        import struct
        self.embedding = struct.pack(f'{len(vector)}f', *vector)
    
    def get_embedding(self) -> list[float]:
        """Retrieve embedding as float list."""
        if not self.embedding:
            return []
        import struct
        return list(struct.unpack(f'{len(self.embedding)//4}f', self.embedding))