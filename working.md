# Counselling AI System - Technical Working Explanation

## System Overview
Counselling AI is a full-stack web application that provides AI-powered counselling sessions across multiple domains (school, medical, psychological, career, relationship). The system combines user input with AI analysis to generate personalized insights and recommendations.

### Backend Architecture: Django Multi-Tenant Platform

The application features a comprehensive Django backend implementing multi-tenant architecture:

#### Core Django Components

**1. Custom User Model (`identity` app)**
- UUID-based primary key (no sequential database IDs exposed)
- Email as primary login identifier
- Phone number with unique constraint and verification
- Email and phone verification flags
- Full name and short name properties

**2. Organization System (`organizations` app)**
- **Organization Model**: First-class tenant with legal name, display name, slug, country, status
- **Organization Application Workflow**: 
  - Users submit applications with legal name, display name, organization type
  - Platform admin reviews and approves/rejects
  - Only approved organizations appear in selection dropdown
  - On approval: Organization created, profile created, owner membership assigned, FREE subscription created
- **Organization Membership**: Explicit through model allowing one user to belong to multiple organizations
- **Organization Roles**: OWNER, ADMIN, MANAGER, MEMBER, VIEWER with system and custom roles
- **Organization Profile**: Logo, cover image, description, website, phone, email, address
- **Tenant Isolation**: Every organization endpoint verifies membership before granting access

**3. Subscription System (`subscriptions` app)**
- **Subscription Plans**: FREE, BASIC, PRO, BUSINESS, ENTERPRISE (database-driven, not hard-coded)
  - Each plan has: monthly/yearly price, max members, max storage MB, max projects
  - Features: api_access, priority_support booleans
- **Subscription Lifecycle**: triling → active → past_due → cancelled → expired
- **Feature Enforcement**: Centralized subscription service checks member limits, storage limits, project limits
- **Payment Abstraction**: Base PaymentProvider class with provider-specific adapters
- **Subscription Events**: Audit log for all status changes

**4. Audit System (`audit` app)**
- **AuditEvent Model**: Logs all security-sensitive events
  - Actor (user), organization, event_type, target_type, target_id
  - IP address, metadata (JSON field)
  - Created timestamp
- **Logged Events**: USER_CREATED, USER_LOGIN, USER_LOGIN_FAILED, PASSWORD_CHANGED
- ORGANIZATION_APPLICATION_CREATED, ORGANIZATION_APPROVED, ORGANIZATION_REJECTED
- MEMBER_INVITED, MEMBER_JOINED, MEMBER_REMOVED, ROLE_CHANGED
- SUBSCRIPTION_CREATED, SUBSCRIPTION_CHANGED, SUBSCRIPTION_CANCELLED

**5. Common Utilities (`common` app)**
- Status choices constants (organization, membership, subscription)
- Permission codenames (organization.view, member.invite, subscription.manage, etc.)
- Helper functions for generating choice lists

#### API Endpoints

**Authentication**
- `POST /api/auth/token/` - JWT login with email/password
- `POST /api/auth/token/refresh/` - Refresh JWT access token
- `POST /api/auth/register/` - Register new user

**Organizations**
- `GET /api/organizations/available/` - List approved organizations for selection (never shows pending/rejected/suspended/archived)
- `POST /api/organizations/applications/` - Create organization application (pending status)
- `POST /api/organizations/{id}/join/` - Join approved organization (backend verifies authorization)
- `GET /api/organizations/{id}/members/` - List organization members (admin only)
- `POST /api/organizations/{id}/members/invite/` - Invite user to organization
- `PATCH /api/organizations/{id}/members/{member_id}/` - Update member role
- `DELETE /api/organizations/{id}/members/{member_id}/` - Remove member

**Subscriptions**
- `GET /api/subscription-plans/` - List available subscription plans
- `GET /api/organizations/{id}/subscription/` - Get organization subscription
- `POST /api/organizations/{id}/subscription/change/` - Upgrade/downgrade subscription plan
- `POST /api/organizations/{id}/subscription/cancel/` - Cancel subscription

**Users**
- `GET /api/users/me/` - Get current user profile
- `PATCH /api/users/me/` - Update user profile
- `GET /api/users/me/addresses/` - List user addresses
- `POST /api/users/me/addresses/` - Create address
- `PATCH /api/users/me/addresses/{id}/` - Update address
- `DELETE /api/users/me/addresses/{id}/` - Delete address

#### Permission Classes (DRF)
- `IsOrganizationMember` - Check if user is active member of organization
- `IsOrganizationAdmin` - Check if user is admin or owner
- `IsOrganizationOwner` - Check if user is organization owner
- `CanManageMembers` - Check if admin can manage members
- `CanManageSubscription` - Check if admin can manage subscription

#### Key Workflows

**1. User Registration & Login**
```text
User → Register (email/password) → Email verified → Login → JWT token → API access
```

**2. Organization Membership**
```text
User → Select approved organization from dropdown → 
Backend verifies: organization exists, status=approved, user authorized → 
Create OrganizationMembership → Assign default role
```

**3. Organization Approval (Admin)**
```text
Admin → Review pending application → Approve → 
Organization created → Profile created → Owner membership created → 
FREE subscription created → Application status → approved
```

**4. Subscription Management**
```text
Organization → Check plan limits → Upgrade/downgrade → 
Subscription status changes → Audit event logged → 
Feature limits enforced (members, storage, projects)
```

## Complete System Flow

### Phase 1: Authentication & Onboarding
1. Application loads and checks authentication status
2. If not authenticated, shows login interface
3. If authenticated, user can browse approved organizations
4. User selects organization → backend verifies authorization
5. Organization membership created with default role

### Phase 2: Session Management
1. User creates/counselling sessions
2. Sessions stored with type (school/medical/psychological/career/relationship)
3. AI analysis generated based on session type
4. Results presented to user

### Phase 3: Organization & Subscription Management
1. Admin reviews organization applications
2. Approved organizations receive FREE subscription
3. Admins can upgrade/downgrade subscription plans
4. Feature limits enforced based on plan (members, storage, projects)

### Phase 4: AI-Powered Analysis
1. User completes counselling assessment
2. AI service generates personalized insights
3. Results stored with archetype, risk assessment, trait scores
4. Session history maintained for progress tracking

## Technical Implementation Details

### State Management
- Django ORM for persistent state
- JWT tokens for authentication state
- Session framework for user sessions
- Audit events for security tracking

### AI Integration
- Abstracted AIService class supports multiple providers
- Automatic API key detection from environment variables
- Provider-specific handling for response formatting
- Retry mechanism with exponential backoff
- JSON schema validation for consistent AI outputs
- Specialized role prompting for domain-specific expertise

### Data Persistence
- PostgreSQL (production) or SQLite (development) as authoritative source
- Redis for rate limiting and temporary state
- Audit events logged to database
- Session data managed through Django session framework

### UI/UX Features
- Responsive design with collapsible sidebar
- Animated loading states during AI processing
- Error handling with user-friendly messages
- Role-based UI elements (admin panel visibility)
- Session type badges in header
- Smooth transitions between application states

## Production Considerations

### Security
- Rate-limiting on authentication endpoints
- Password reset with generic "if account exists" messages
- Never expose whether email exists through responses
- Tenant isolation enforced at server-side
- Never trust client-provided organization IDs

### Scalability
- PostgreSQL as authoritative source
- Redis for caching and rate limiting
- Database-constrained integrity (UNIQUE on email/phone, slug, etc.)
- Services layer separates business logic from views

### Extensibility
- SSO/SAML/OIDC support planned
- Multiple billing providers (Stripe, Razorpay, etc.)
- Additional session types can be added
- New role permissions can be created
- Subscription features can be extended

## Development Commands

```bash
# Migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Seed default data (plans and roles)
python manage.py seed_identity_system

# Run development server
python manage.py runserver

# API documentation
# (drf-spectacular or similar)
```

## Design Rules Compliance

The implementation strictly follows the 50 design rules including:
- One user = one global identity (RULE 1)
- User may belong to multiple organizations (RULE 2)
- Organization is a tenant (RULE 3)
- Organization approval mandatory (RULE 4)
- Only approved organizations selectable (RULE 5)
- Selection doesn't grant automatic authorization (RULE 6)
- Membership determines organization belonging (RULE 7)
- Roles determine member capabilities (RULE 8)
- Permissions determine specific actions (RULE 9)
- Subscription determines feature limits (RULE 10)
- UUIDs identify but don't replace authorization (RULE 11)
- Precise addresses private by default (RULE 12)
- Billing providers abstracted (RULE 13)
- Sensitive operations create audit events (RULE 14)
- Tenant isolation server-side (RULE 15)
- Business logic in services (RULE 16)
- Database constraints protect integrity (RULE 17)
- Never trust client-supplied IDs (RULE 18)
- Never expose sensitive serializer fields (RULE 19)
- All security endpoints need explicit permissions (RULE 20)