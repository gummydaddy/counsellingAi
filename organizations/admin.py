from django.contrib import admin
from .models import (
    Organization, OrganizationApplication, OrganizationProfile,
    OrganizationMembership, OrganizationRole,
    InstitutionAdminProfile, InstitutionUserAssociation
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = [
        "display_name", "legal_name", "slug", "organization_type",
        "institution_type", "institution_status", "status",
        "created_by", "approved_by", "created_at"
    ]
    list_filter = [
        "status", "institution_type", "institution_status", "country",
        "organization_type", "created_at"
    ]
    search_fields = ["display_name", "legal_name", "slug", "registration_number"]
    readonly_fields = [
        "id", "slug", "created_by", "approved_by", "approved_at",
        "institution_enabled_at", "institution_enabled_by",
        "created_at", "updated_at"
    ]
    fieldsets = (
        ("Basic Information", {
            "fields": ("id", "legal_name", "display_name", "slug", "organization_type", "registration_number", "country")
        }),
        ("Status", {
            "fields": ("status", "approved_by", "approved_at")
        }),
        ("Institution/Administration Settings", {
            "fields": ("institution_type", "institution_status", "institution_enabled_at", "institution_enabled_by"),
            "description": "Institution/Administration access controls. Accounts are inactive by default. Superadmins can enable/disable access here."
        }),
        ("Ownership", {
            "fields": ("created_by",)
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at")
        }),
    )
    actions = ["enable_institution_access", "disable_institution_access"]

    def enable_institution_access(self, request, queryset):
        """Enable institution access for selected organizations."""
        updated = 0
        for org in queryset:
            if org.institution_type and org.institution_status != "active":
                org.enable_institution(request.user)
                updated += 1
        self.message_user(request, f"Enabled institution access for {updated} organizations.")

    def disable_institution_access(self, request, queryset):
        """Disable institution access for selected organizations."""
        updated = 0
        for org in queryset:
            if org.institution_type and org.institution_status == "active":
                org.disable_institution()
                updated += 1
        self.message_user(request, f"Disabled institution access for {updated} organizations.")

    enable_institution_access.short_description = "Enable institution access for selected organizations"
    disable_institution_access.short_description = "Disable institution access for selected organizations"


@admin.register(OrganizationApplication)
class OrganizationApplicationAdmin(admin.ModelAdmin):
    list_display = [
        "display_name", "legal_name", "organization_type",
        "status", "applicant", "reviewed_by", "created_at"
    ]
    list_filter = ["status", "organization_type", "created_at"]
    search_fields = ["display_name", "legal_name", "applicant__email"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(OrganizationProfile)
class OrganizationProfileAdmin(admin.ModelAdmin):
    list_display = ["organization", "website", "email", "phone"]
    search_fields = ["organization__display_name", "website", "email"]


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "role", "status", "joined_at"]
    list_filter = ["status", "role__name", "organization__institution_type"]
    search_fields = ["user__email", "organization__display_name"]
    readonly_fields = ["id", "created_at"]


@admin.register(OrganizationRole)
class OrganizationRoleAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "organization", "is_system_role", "created_at"]
    list_filter = ["is_system_role", "organization"]
    search_fields = ["name", "code"]


@admin.register(InstitutionAdminProfile)
class InstitutionAdminProfileAdmin(admin.ModelAdmin):
    list_display = [
        "user", "organization", "role", "is_primary_admin",
        "can_manage_users", "can_view_analytics", "status", "created_at"
    ]
    list_filter = ["role", "status", "can_manage_users", "can_view_analytics", "organization__institution_type"]
    search_fields = ["user__email", "organization__display_name", "user__first_name", "user__last_name"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(InstitutionUserAssociation)
class InstitutionUserAssociationAdmin(admin.ModelAdmin):
    list_display = [
        "user", "institution", "association_type", "status", "added_by", "created_at"
    ]
    list_filter = ["association_type", "status", "institution__institution_type"]
    search_fields = ["user__email", "institution__display_name", "user__first_name", "user__last_name"]
    readonly_fields = ["id", "created_at", "updated_at"]