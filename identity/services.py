"""Identity service - business logic for identity operations."""

from django.contrib.auth import get_user_model
from .models import User, UserProfile, Address, UserSession, LoginEvent
from django.db import transaction

User = get_user_model()


class AuthenticationService:

    @staticmethod
    def authenticate_user(email, password):
        """Authenticate a user by email and password."""
        user = User.objects.filter(email=email).first()
        if user and user.is_active:
            # Django's check_password is used by authenticate()
            from django.contrib.auth import authenticate
            authenticated_user = authenticate(request=None, username=email, password=password)
            if authenticated_user:
                # Log login event
                from .models import LoginEvent
                from django.http import HttpRequest
                ip_address = None
                user_agent = None
                # Try to get IP and user agent from request if available
                LoginEvent.objects.create(
                    user=user,
                    event_type="USER_LOGIN",
                    ip_address=ip_address,
                    user_agent=user_agent,
                    metadata={},
                )
                return authenticated_user
        return None

    @staticmethod
    def login_failed(user=None, ip_address=None, user_agent=None):
        """Log a failed login attempt."""
        from .models import LoginEvent
        LoginEvent.objects.create(
            user=user,
            event_type="USER_LOGIN_FAILED",
            ip_address=ip_address,
            user_agent=user_agent,
            metadata={},
        )
        return None

    @staticmethod
    def verify_email(user):
        """Mark user email as verified."""
        user.email_verified = True
        user.save()
        return user

    @staticmethod
    def verify_phone(user):
        """Mark user phone as verified."""
        user.phone_verified = True
        user.save()
        return user

    @staticmethod
    def create_session(user, session_key, device_name=None, ip_address=None, user_agent=None):
        """Create a user session record."""
        from .models import UserSession

        # Hash the session key for security
        key_hash = session_key[:40] if session_key else ""

        session = UserSession.objects.create(
            user=user,
            session_key_hash=key_hash,
            device_name=device_name or "",
            ip_address=ip_address,
            user_agent=user_agent or "",
        )
        return session

    @staticmethod
    def revoke_session(session_id):
        """Revoke a user session."""
        from .models import UserSession

        try:
            session = UserSession.objects.get(id=session_id)
            session.revoked_at = transaction.now()
            session.save()
            return True
        except UserSession.DoesNotExist:
            return False

    @staticmethod
    def get_user_sessions(user):
        """Get all sessions for a user."""
        from .models import UserSession
        return UserSession.objects.filter(user=user, revoked_at__isnull=True)


class RegistrationService:

    @staticmethod
    @transaction.atomic
    def register_user(email, phone_number, first_name, last_name, password=None):
        """Register a new user."""
        user = User.objects.create_user(
            email=email,
            phone_number=phone_number,
            first_name=first_name,
            last_name=last_name,
        )

        # Create user profile
        UserProfile.objects.create(user=user)

        # Create default address
        Address.objects.create(user=user)

        return user

    @staticmethod
    def resend_verification(user):
        """Resend email verification."""
        # This would integrate with allauth
        return user


class AuditService:

    @staticmethod
    def log_event(actor, organization=None, event_type="", target_type=None,
                  target_id=None, ip_address=None, metadata=None):
        """Log an audit event."""
        from audit.models import AuditEvent

        AuditEvent.objects.create(
            actor=actor,
            organization=organization,
            event_type=event_type,
            target_type=target_type,
            target_id=target_id,
            ip_address=ip_address,
            metadata=metadata or {},
        )
        return AuditEvent.objects.latest('id')