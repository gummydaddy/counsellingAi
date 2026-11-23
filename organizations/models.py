import uuid
from django.db import models
from django.conf import settings
from django.db.models import UniqueConstraint


def organization_upload_path(instance, filename):
    """Upload path for organization logo."""
    return f"organizations/{instance.organization.id}/profile/{filename}"


INSTITUTION_TYPES = [
    ("institute", "Institute"),
    ("administration", "Administration"),
]

INSTITUTION_STATUS_CHOICES = [
    ("pending", "Pending"),
    ("active", "Active"),
    ("inactive", "Inactive"),
    ("suspended", "Suspended"),
    ("archived", "Archived"),
]


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

    # Institution/Administration specific fields
    institution_type = models.CharField(
        max_length=20,
        choices=INSTITUTION_TYPES,
        blank=True,
        null=True,
        help_text="Type of institution: institute or administration"
    )

    institution_status = models.CharField(
        max_length=20,
        choices=INSTITUTION_STATUS_CHOICES,
        default="inactive",
        help_text="Institution/Admin access status - inactive by default, superadmin can enable"
    )

    institution_enabled_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When institution access was enabled by superadmin"
    )

    institution_enabled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="enabled_institutions",
        help_text="Superadmin who enabled this institution"
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

    @property
    def is_institution(self):
        """Check if this organization is an institute or administration."""
        return self.institution_type in ["institute", "administration"]

    @property
    def is_institution_active(self):
        """Check if institution access is active."""
        return self.is_institution and self.institution_status == "active"

    def enable_institution(self, enabled_by):
        """Enable institution access (superadmin action)."""
        self.institution_status = "active"
        self.institution_enabled_at = models.functions.Now()
        self.institution_enabled_by = enabled_by
        self.save(update_fields=["institution_status", "institution_enabled_at", "institution_enabled_by", "updated_at"])

    def disable_institution(self):
        """Disable institution access (superadmin action)."""
        self.institution_status = "inactive"
        self.institution_enabled_at = None
        self.institution_enabled_by = None
        self.save(update_fields=["institution_status", "institution_enabled_at", "institution_enabled_by", "updated_at"])


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


INSTITUTION_ADMIN_ROLES = [
    ("institute_admin", "Institute Admin"),
    ("institute_staff", "Institute Staff"),
    ("administration_admin", "Administration Admin"),
    ("administration_staff", "Administration Staff"),
]


class InstitutionAdminProfile(models.Model):
    """Profile for users who are admins/staff of an institution/administration."""
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="institution_admin_profiles"
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="institution_admin_profiles"
    )

    role = models.CharField(
        max_length=30,
        choices=INSTITUTION_ADMIN_ROLES,
        help_text="Role within the institution/administration"
    )

    is_primary_admin = models.BooleanField(
        default=False,
        help_text="Whether this user is the primary admin contact"
    )

    can_manage_users = models.BooleanField(
        default=True,
        help_text="Can search and add users to the institution"
    )

    can_view_analytics = models.BooleanField(
        default=True,
        help_text="Can view institution analytics"
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ("active", "Active"),
            ("inactive", "Inactive"),
            ("suspended", "Suspended"),
        ],
        default="active"
    )

    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="assigned_institution_admins",
        help_text="Superadmin who assigned this role"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Institution Admin Profile"
        verbose_name_plural = "Institution Admin Profiles"
        constraints = [
            UniqueConstraint(
                fields=["user", "organization", "role"],
                name="unique_institution_admin_role"
            )
        ]

    def __str__(self):
        return f"{self.user.email} - {self.organization.display_name} ({self.role})"


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


class InstitutionUserAssociation(models.Model):
    """Association between platform users and an institution/administration.
    
    This tracks which users (students, patients, clients) are associated
    with a specific institution for management and dashboard purposes.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    institution = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="user_associations",
        limit_choices_to={"institution_type__in": ["institute", "administration"]}
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="institution_associations"
    )

    association_type = models.CharField(
        max_length=30,
        choices=[
            ("student", "Student"),
            ("patient", "Patient"),
            ("client", "Client"),
            ("member", "Member"),
            ("other", "Other"),
        ],
        default="member"
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ("active", "Active"),
            ("inactive", "Inactive"),
            ("archived", "Archived"),
        ],
        default="active"
    )

    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="added_institution_users",
        help_text="Institution admin who added this user"
    )

    notes = models.TextField(blank=True, help_text="Internal notes about this association")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Institution User Association"
        verbose_name_plural = "Institution User Associations"
        constraints = [
            UniqueConstraint(
                fields=["institution", "user"],
                name="unique_institution_user_association"
            )
        ]
        indexes = [
            models.Index(fields=["institution", "status"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"{self.user.email} @ {self.institution.display_name} ({self.association_type})"


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