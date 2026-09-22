"""Organizations API serializers."""

from organizations.models import (
    Organization, OrganizationApplication, OrganizationProfile,
    OrganizationMembership, OrganizationRole
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
            "created_by", "approved_by", "approved_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "slug", "created_by", "approved_by", "approved_at",
            "created_at", "updated_at",
        ]


class OrganizationListSerializer(serializers.ModelSerializer):
    """Serializer for organization list (dropdown)."""

    class Meta:
        model = Organization
        fields = ["id", "display_name", "organization_type", "status"]


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