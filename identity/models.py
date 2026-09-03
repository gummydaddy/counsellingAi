import uuid
from django.db import models
from django.conf import settings
from django.contrib.auth.models import BaseUserManager, AbstractBaseUser, PermissionsMixin


class MyUserManager(BaseUserManager):

    def create_user(self, email, phone_number=None, **extra_fields):
        """Create and return a regular user."""
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(
            email=email,
            phone_number=phone_number,
            **extra_fields
        )
        user.is_active = True
        user.save(using=self._db)
        return user

    def create_superuser(self, email, phone_number=None, **extra_fields):
        """Create and return a superuser."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        user = self.model(
            email=email,
            phone_number=phone_number,
            **extra_fields
        )
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User model using UUID as primary key and email as identifier."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    email = models.EmailField(
        unique=True,
        db_index=True
    )

    phone_number = models.CharField(
        max_length=32,
        unique=True,
        null=True,
        blank=True
    )

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    email_verified = models.BooleanField(default=False)
    phone_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = MyUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    def get_full_name(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name if full_name else self.email

    def get_short_name(self):
        return self.first_name or self.email

    def __str__(self):
        return self.email

    @property
    def is_organization_owner(self):
        """Check if user is an org owner in any of their organizations."""
        from organizations.models import OrganizationMembership
        return OrganizationMembership.objects.filter(
            user=self,
            role__name='OWNER',
            status='active'
        ).exists()


def user_upload_path(instance, filename):
    """Upload path for user avatar."""
    return f"users/{instance.user.id}/avatars/{filename}"


class UserProfile(models.Model):
    """Extended profile for user authentication data."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile"
    )

    display_name = models.CharField(max_length=150, blank=True)
    avatar = models.ImageField(
        upload_to=user_upload_path,
        blank=True,
        null=True
    )
    bio = models.TextField(blank=True)

    date_of_birth = models.DateField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile for {self.user.email}"


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
        related_name="identity_addresses"
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


class UserSession(models.Model):
    """Track user sessions for security and revocation."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sessions"
    )

    session_key_hash = models.CharField(max_length=255)
    device_name = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "User Session"
        verbose_name_plural = "User Sessions"


class LoginEvent(models.Model):
    """Audit log for login events."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    event_type = models.CharField(max_length=100)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)