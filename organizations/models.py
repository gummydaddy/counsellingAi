import uuid
from django.db import models
from django.conf import settings
from django.db.models import UniqueConstraint


def organization_upload_path(instance, filename):
    """Upload path for organization logo."""
    return f"organizations/{instance.organization.id}/profile/{filename}"


class Organization(models.Model):
    """First-class tenant model."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    legal_name = models.CharField(max_length=255)

    display_name = models.CharField(max_length=255)

    slug = models.SlugField(unique=True, max_length=255)

    organization_type = models.CharField(max_length=100)

    registration_number = models.CharField(max_length=255, blank=True)

    country = models.CharField(max_length=2)

    status = models.CharField(
        max_length=30,
        choices=[
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("suspended", "Suspended"),
            ("archived", "Archived"),
        ],
        default="pending"
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_organizations"
    )

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approved_organizations"
    )

    approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"
        ordering = ['-created_at']

    def __str__(self):
        return self.display_name


class OrganizationApplication(models.Model):
    """Organization application model - created before approval."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="organization_applications"
    )

    legal_name = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255)

    organization_type = models.CharField(max_length=100)

    registration_number = models.CharField(max_length=255, blank=True)

    description = models.TextField(blank=True)

    status = models.CharField(
        max_length=30,
        choices=[
            ("pending", "Pending"),
            ("under_review", "Under Review"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        default="pending"
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_organization_applications"
    )

    reviewed_at = models.DateTimeField(null=True, blank=True)

    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Organization Application"
        verbose_name_plural = "Organization Applications"


class OrganizationRole(models.Model):
    """Organization roles model."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="roles",
        null=True,
        blank=True
    )

    name = models.CharField(max_length=100)

    code = models.SlugField(max_length=100)

    description = models.TextField(blank=True)

    is_system_role = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Organization Role"
        verbose_name_plural = "Organization Roles"

    def __str__(self):
        return f"{self.name} ({self.organization.display_name if self.organization else 'global'})"


class OrganizationMembership(models.Model):
    """Organization membership through explicit through model."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships"
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="organization_memberships"
    )

    role = models.ForeignKey(
        "OrganizationRole",
        on_delete=models.PROTECT,
        related_name="memberships"
    )

    status = models.CharField(
        max_length=30,
        choices=[
            ("invited", "Invited"),
            ("active", "Active"),
            ("suspended", "Suspended"),
            ("removed", "Removed"),
        ],
        default="active"
    )

    joined_at = models.DateTimeField(auto_now_add=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Organization Membership"
        verbose_name_plural = "Organization Memberships"
        constraints = [
            UniqueConstraint(
                fields=["organization", "user"],
                name="unique_organization_user"
            )
        ]

    def __str__(self):
        return f"{self.user.email} @ {self.organization.display_name} ({self.role.name})"


class OrganizationProfile(models.Model):
    """Organization profile model."""

    organization = models.OneToOneField(
        Organization,
        on_delete=models.CASCADE,
        related_name="profile"
    )

    logo = models.ImageField(
        upload_to=organization_upload_path,
        blank=True,
        null=True
    )
    cover_image = models.ImageField(
        blank=True,
        null=True
    )

    description = models.TextField(blank=True)

    website = models.URLField(blank=True)

    phone = models.CharField(max_length=32, blank=True, null=True)

    email = models.EmailField(blank=True)

    address = models.OneToOneField(
        'common.Address',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Organization Profile"
        verbose_name_plural = "Organization Profiles"