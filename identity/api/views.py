"""Identity API views."""

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from identity.models import User, UserProfile, UserSession, LoginEvent
from common.models import Address
from .serializers import (
    UserSerializer, UserProfileSerializer, AddressSerializer,
    LoginEventSerializer, UserSessionSerializer
)


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User model."""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = []

    def get_queryset(self):
        return User.objects.filter(is_active=True)

    @action(detail=False, methods=["post"], url_path="register")
    def register(self, request):
        """Register a new user."""
        from identity.services import RegistrationService
        from django.http import HttpRequest

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = RegistrationService.register_user(
            email=serializer.validated_data["email"],
            phone_number=serializer.validated_data.get("phone_number"),
            first_name=serializer.validated_data["first_name"],
            last_name=serializer.validated_data["last_name"],
        )

        # Log registration event
        LoginEvent.objects.create(
            user=user,
            event_type="USER_CREATED",
            metadata={},
        )

        return Response(
            UserSerializer(user).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["post"], url_path="login")
    def login(self, request):
        """Login a user."""
        email = request.data.get("email")
        password = request.data.get("password")

        user = authenticate_user(email, password)

        if user:
            # Create session
            from identity.services import AuthenticationService
            session = AuthenticationService.create_session(
                user=user,
                session_key=request.META.get("HTTP_AUTHORIZATION", ""),
                ip_address=self._get_ip(request),
                user_agent=self._get_user_agent(request),
            )

            return Response(
                UserSerializer(user).data,
                status=status.HTTP_200_OK
            )
        else:
            # Log failed login
            from identity.services import AuthenticationService
            AuthenticationService.login_failed(
                ip_address=self._get_ip(request),
                user_agent=self._get_user_agent(request),
            )
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )

    @staticmethod
    def _get_ip(request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip

    @staticmethod
    def _get_user_agent(request):
        return request.META.get("HTTP_USER_AGENT", "")

    @action(detail=False, methods=["post"], url_path="logout")
    def logout(self, request):
        """Logout a user."""
        from identity.services import AuthenticationService

        session_id = request.data.get("session_id")
        if session_id:
            AuthenticationService.revoke_session(session_id)
        else:
            # Revoke all sessions
            AuthenticationService.get_user_sessions(request.user).delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class UserProfileViewSet(viewsets.ModelViewSet):
    """ViewSet for UserProfile model."""

    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = []


class AddressViewSet(viewsets.ModelViewSet):
    """ViewSet for Address model."""

    queryset = Address.objects.all()
    serializer_class = AddressSerializer
    permission_classes = []

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    @action(detail=False, methods=["get"], url_path="primary")
    def primary_address(self, request):
        """Get user's primary address."""
        address = Address.objects.filter(
            user=request.user, is_primary=True
        ).first()
        serializer = self.get_serializer(address)
        return Response(serializer.data)

    @action(detail=True, methods=["patch"], url_path="set-primary")
    def set_primary(self, request, pk=None):
        """Set an address as primary."""
        address = self.get_object()
        Address.objects.filter(user=request.user).update(is_primary=False)
        address.is_primary = True
        address.save()
        serializer = self.get_serializer(address)
        return Response(serializer.data)


class LoginEventViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for LoginEvent model (read-only)."""

    queryset = LoginEvent.objects.all()
    serializer_class = LoginEventSerializer
    permission_classes = []


class UserSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for UserSession model (read-only)."""

    queryset = UserSession.objects.all()
    serializer_class = UserSessionSerializer
    permission_classes = []


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom token obtain pair view that uses our authentication."""

    def post(self, request, *args, **kwargs):
        """Login and obtain JWT tokens."""
        email = request.data.get("email")
        password = request.data.get("password")

        # Use Django's authenticate with email as username
        user = authenticate(request=request, username=email, password=password)

        if user:
            # Create session
            from identity.services import AuthenticationService
            session = AuthenticationService.create_session(
                user=user,
                session_key=request.META.get("HTTP_AUTHORIZATION", ""),
                ip_address=self._get_ip(request),
                user_agent=self._get_user_agent(request),
            )

            response = super().post(request, *args, **kwargs)
            return response
        else:
            # Log failed login
            from identity.services import AuthenticationService
            AuthenticationService.login_failed(
                ip_address=self._get_ip(request),
                user_agent=self._get_user_agent(request),
            )
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )

    @staticmethod
    def _get_ip(request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip

    @staticmethod
    def _get_user_agent(request):
        return request.META.get("HTTP_USER_AGENT", "")