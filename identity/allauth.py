"""Minimal allauth adapter for custom user model."""

from allauth.account.adapter import DefaultAccountAdapter


class Adapters(DefaultAccountAdapter):

    def save_user(self, request, user, form=None):
        """Save user with email as primary identifier."""
        user = super().save_user(request, user, form)
        if user.email:
            user.email = user.email.lower()
        return user