import uuid
from django.db import models
from django.conf import settings


class AuditEvent(models.Model):
    """Audit log for all security-sensitive events."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    event_type = models.CharField(max_length=100)

    target_type = models.CharField(
        max_length=100,
        blank=True
    )

    target_id = models.UUIDField(
        null=True,
        blank=True
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True
    )

    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Audit Event"
        verbose_name_plural = "Audit Events"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type} by {self.actor.email if self.actor else 'system'} at {self.created_at}"