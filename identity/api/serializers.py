"""Identity API serializers."""

from identity.models import User, UserProfile, Address, UserSession, LoginEvent
from rest_framework import serializers


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""

    class Meta:
        model = User
        fields = [
            "id", "email", "phone_number", "first_name", "last_name",
            "is_active", "email_verified", "phone_verified",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "last_login"]


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for UserProfile model."""

    class Meta:
        model = UserProfile
        fields = [
            "display_name", "avatar", "bio", "date_of_birth",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class AddressSerializer(serializers.ModelSerializer):
    """Serializer for Address model."""

    class Meta:
        model = Address
        fields = [
            "id", "address_type", "address_line_1", "address_line_2",
            "landmark", "locality", "city", "district", "state",
            "postal_code", "country", "latitude", "longitude",
            "geocoded", "is_primary", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, data):
        """Ensure at least one primary address exists."""
        return data


class LoginEventSerializer(serializers.ModelSerializer):
    """Serializer for LoginEvent model."""

    class Meta:
        model = LoginEvent
        fields = [
            "id", "event_type", "ip_address", "user_agent",
            "metadata", "created_at",
        ]
        read_only_fields = "__all__"


class UserSessionSerializer(serializers.ModelSerializer):
    """Serializer for UserSession model."""

    class Meta:
        model = UserSession
        fields = [
            "id", "device_name", "ip_address", "user_agent",
            "created_at", "last_seen_at", "revoked_at",
        ]
        read_only_fields = "__all__"