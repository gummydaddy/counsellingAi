"""Organizations API serializers."""

from organizations.models import (
    Organization, OrganizationApplication, OrganizationProfile,
    OrganizationMembership, OrganizationRole,
    InstitutionAdminProfile, InstitutionUserAssociation
)
from common.models import Address
from identity.models import User
from rest_framework import serializers


class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer for Organization model."""

    class Meta:
        model = Organization
        fields = [
            "id", "legal_name", "display_name", "slug", "organization_type",
            "registration_number", "country", "status",
            "institution_type", "institution_status", "institution_enabled_at", "institution_enabled_by",
            "created_by", "approved_by", "approved_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "slug", "created_by", "approved_by", "approved_at",
            "institution_enabled_at", "institution_enabled_by",
            "created_at", "updated_at",
        ]


class OrganizationListSerializer(serializers.ModelSerializer):
    """Serializer for organization list (dropdown)."""

    institution_type = serializers.CharField(read_only=True)
    institution_status = serializers.CharField(read_only=True)

    class Meta:
        model = Organization
        fields = ["id", "display_name", "organization_type", "status", "institution_type", "institution_status"]


class OrganizationApplicationSerializer(serializers.ModelSerializer):
    """Serializer for OrganizationApplication model."""

    applicant_name = serializers.CharField(
        source="applicant.get_short_name", read_only=True
    )

    class Meta:
        model = OrganizationApplication
        fields = [
            "id", "applicant", "applicant_name", "legal_name", "display_name",
            "organization_type", "registration_number", "description",
            "status", "reviewed_by", "reviewed_at", "rejection_reason",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "created_at", "updated_at",
        ]


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    """Serializer for OrganizationMembership model."""

    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(
        source="user.get_short_name", read_only=True
    )
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = [
            "id", "organization", "role", "role_name", "user",
            "user_email", "user_name", "status", "joined_at", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class OrganizationRoleSerializer(serializers.ModelSerializer):
    """Serializer for OrganizationRole model."""

    class Meta:
        model = OrganizationRole
        fields = [
            "id", "name", "code", "description", "is_system_role",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class OrganizationProfileSerializer(serializers.ModelSerializer):
    """Serializer for OrganizationProfile model."""

    logo_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationProfile
        fields = [
            "id", "logo", "logo_url", "cover_image", "cover_image_url",
            "description", "website", "phone", "email", "address",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_logo_url(self, obj):
        if obj.logo:
            return obj.logo.url
        return None

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            return obj.cover_image.url
        return None


# Institution/Administration Serializers

class InstitutionAdminProfileSerializer(serializers.ModelSerializer):
    """Serializer for InstitutionAdminProfile model."""

    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.get_short_name", read_only=True)
    organization_name = serializers.CharField(source="organization.display_name", read_only=True)
    organization_type = serializers.CharField(source="organization.institution_type", read_only=True)

    class Meta:
        model = InstitutionAdminProfile
        fields = [
            "id", "user", "user_email", "user_name", "organization", "organization_name",
            "organization_type", "role", "is_primary_admin", "can_manage_users",
            "can_view_analytics", "status", "assigned_by", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class InstitutionUserAssociationSerializer(serializers.ModelSerializer):
    """Serializer for InstitutionUserAssociation model."""

    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.get_short_name", read_only=True)
    user_first_name = serializers.CharField(source="user.first_name", read_only=True)
    user_last_name = serializers.CharField(source="user.last_name", read_only=True)
    user_phone = serializers.CharField(source="user.phone_number", read_only=True)
    user_date_joined = serializers.DateTimeField(source="user.created_at", read_only=True)
    added_by_name = serializers.CharField(source="added_by.get_short_name", read_only=True)
    institution_name = serializers.CharField(source="institution.display_name", read_only=True)

    class Meta:
        model = InstitutionUserAssociation
        fields = [
            "id", "institution", "institution_name", "user", "user_email", "user_name",
            "user_first_name", "user_last_name", "user_phone", "user_date_joined",
            "association_type", "status", "added_by", "added_by_name", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class InstitutionLoginSerializer(serializers.Serializer):
    """Serializer for institution login."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    institution_id = serializers.UUIDField(required=False, help_text="Optional: specific institution ID if user has multiple")


class InstitutionLoginResponseSerializer(serializers.Serializer):
    """Serializer for institution login response."""

    user = serializers.DictField()
    institution_admin_profile = InstitutionAdminProfileSerializer()
    access = serializers.CharField()
    refresh = serializers.CharField()


class InstitutionDashboardSerializer(serializers.Serializer):
    """Serializer for institution dashboard data."""

    institution = OrganizationSerializer()
    admin_profile = InstitutionAdminProfileSerializer()
    total_users = serializers.IntegerField()
    user_counts = serializers.DictField()
    associations = InstitutionUserAssociationSerializer(many=True)


class UserSearchResultSerializer(serializers.ModelSerializer):
    """Serializer for user search results."""

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "phone_number", "created_at"]


class AssociateUserSerializer(serializers.Serializer):
    """Serializer for associating a user with an institution."""

    user_id = serializers.UUIDField()
    association_type = serializers.ChoiceField(
        choices=InstitutionUserAssociation._meta.get_field("association_type").choices,
        default="member"
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")