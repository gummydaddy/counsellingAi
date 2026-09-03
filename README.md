# Counselling AI: AI-Powered Personalized Guidance Platform

## Overview
Counselling AI is a full-stack application that delivers personalized, expert-level guidance across multiple domains including academic, medical, psychological, career, and relationship counselling. The platform combines AI-powered analysis with a robust Django multi-tenant backend for user authentication, organization management, and subscription handling.

## Architecture

### Frontend (React + Vite)
- Modern React 19 interface with Vite build tooling
- Component-based architecture with responsive design
- State management using React hooks
- AI service integration with multiple provider support (Gemini, OpenAI, etc.)

### Backend (Django Multi-Tenant)
A complete Django implementation featuring:

#### Custom User Model
- UUID-based primary key (no sequential IDs exposed)
- Email as primary login identifier
- Phone number validation and verification
- Email and phone verification flags

#### Organization System
- **Organization Application Workflow**: Users submit applications → Admin review → Approved organizations created
- **Organization Membership**: Users can belong to multiple organizations via explicit through model
- **Role-Based Permissions**: OWNER, ADMIN, MANAGER, MEMBER, VIEWER roles with fine-grained checks
- **Organization Profile**: Logo, description, website, contact information
- **Tenant Isolation**: Every organization endpoint enforces membership verification

#### Subscription & Billing
- **Database-Driven Plans**: FREE, BASIC, PRO, BUSINESS, ENTERPRISE (not hard-coded)
- **Subscription Lifecycle**: Trialing → Active → Past Due → Cancelled → Expired
- **Feature Limits**: Member limits, storage limits, project limits per plan
- **Payment Abstraction**: Abstract payment providers (Stripe, Razorpay, etc.)

#### Authentication & Security
- **JWT Authentication**: Minimal claims, organization context resolved server-side
- **Session Management**: Track and revoke user sessions
- **Audit Logging**: All security events logged (login, organization changes, subscription updates)
- **Permission Classes**: Reusable DRF permission classes for organization context
- **Tenant Isolation**: UUIDs identify objects but never replace authorization

#### Key Features
1. **One User = One Global Identity** - Users can belong to multiple organizations
2. **Organization Approval Mandatory** - Only approved organizations selectable
3. **Roles Determine Actions** - Permissions based on role, not boolean fields
4. **Subscription Limits** - Member, storage, project limits per plan
5. **Private Addresses** - Precise coordinates private by default
6. **UUID Identifiers** - Never expose sequential database IDs
7. **Server-Side Tenant Isolation** - Never trust client-provided organization IDs
8. **Abstracted Payment Providers** - Easy to switch between Stripe, Razorpay, etc.

## Project Structure

```
project/
├── config/             # Django project settings
├── identity/          # Custom User, profiles, addresses, auth
├── organizations/     # Organizations, applications, memberships, roles
├── subscriptions/     # Plans, subscriptions, payment abstraction
├── audit/             # Audit event logging
└── common/            # Constants, validators, utilities
```

## Getting Started

### Prerequisites
- Python 3.13+
- Django 6.0+
- PostgreSQL (production) or SQLite (development)
- Node.js 18+ (for frontend)

### Installation

1. **Backend**:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### API Endpoints

#### Authentication
- `POST /api/auth/token/` - JWT login with email/password
- `POST /api/auth/token/refresh/` - Refresh JWT access token
- `POST /api/auth/register/` - Register new user

#### Organizations
- `GET /api/organizations/available/` - List approved organizations
- `POST /api/organizations/applications/` - Create organization application
- `GET /api/organizations/{id}/` - Organization details
- `GET /api/organizations/{id}/members/` - List organization members
- `POST /api/organizations/{id}/members/invite/` - Invite member

#### Subscriptions
- `GET /api/subscription-plans/` - List available plans
- `GET /api/organizations/{id}/subscription/` - Get organization subscription
- `POST /api/organizations/{id}/subscription/change/` - Upgrade/downgrade plan
- `POST /api/organizations/{id}/subscription/cancel/` - Cancel subscription

## Design Rules Followed

The implementation adheres to all 50 design rules including:

- **RULE 1**: One user = one global identity
- **RULE 2**: A user may belong to multiple organizations
- **RULE 3**: An organization is a tenant
- **RULE 4**: Organization approval is mandatory
- **RULE 5**: Only approved organizations are selectable
- **RULE 6**: Selecting an organization does not automatically grant authorization
- **RULE 7**: Membership determines whether a user belongs to an organization
- **RULE 8**: Roles determine what the member can do
- **RULE 9**: Permissions determine specific actions
- **RULE 10**: Subscription determines feature/usage limits
- **RULE 11**: UUIDs identify objects but never replace authorization
- **RULE 12**: Precise addresses are private by default
- **RULE 13**: Billing providers must be abstracted
- **RULE 14**: Sensitive operations must create audit events
- **RULE 15**: Tenant isolation must be enforced server-side
- **RULE 16**: Business logic belongs in services, not scattered throughout views
- **RULE 17**: Database constraints must protect data integrity
- **RULE 18**: Never trust organization IDs supplied by clients
- **RULE 19**: Never expose sensitive fields through serializers by accident
- **RULE 20**: All security-sensitive endpoints require explicit permission classes

## Development Status

✅ Completed:
- Custom User model with UUID and email authentication
- Organization application and approval workflow
- Multi-organization membership system
- Role-based permissions (OWNER/ADMIN/MANAGER/MEMBER/VIEWER)
- Database-driven subscription plans (FREE/BASIC/PRO/BUSINESS/ENTERPRISE)
- JWT authentication with minimal claims
- Session management and revocation
- Audit event logging
- Tenant isolation enforcement
- Permission classes for organization context
- Address model with privacy protections
- Seed data management command
- API endpoint skeleton

🔄 In Progress:
- Full test suite development
- CSRF protection for API endpoints
- Password reset/verification flow
- Organization profile creation workflow
- Complete subscription upgrade/downgrade flow
- Payment provider integration points

📋 Planned:
- SSO/social login/MFA support
- Enterprise billing and usage-based billing
- Organization hierarchy and parent/sub-org relationships
- SCIM provisioning support
- Advanced geocoding and address normalization