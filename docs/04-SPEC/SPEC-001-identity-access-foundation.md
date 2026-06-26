# SPEC-001: Identity & Access Foundation

## Status

Proposed

## Owner

MAIA Intelligence Engineering

## Overview

SPEC-001 defines the identity and access foundation for MAIA Intelligence.

Clerk is the external identity provider. It proves that a user has authenticated with an external identity system. MAIA remains the internal authorization authority for tenant isolation, organization ownership, membership authorization, product-level access, auditability, sensitive access controls, AI trace attribution, and future enterprise authorization.

Authentication is not authorization. A valid Clerk session proves identity only. A MAIA internal membership authorizes access.

## Scope

This SPEC covers:

* Clerk Authentication
* Session Management
* User Synchronization
* Tenant Bootstrap
* Organization Bootstrap
* Membership Bootstrap
* Authorization Context
* Protected Routes

## Non-Goals

This SPEC does not implement:

* Billing
* AI execution
* Memory policy enforcement
* Sensitive PIN workflow
* Role management UI
* Admin console
* Organization invitations
* External API integrations
* Cost Engine enforcement
* Notification Engine enforcement

## Design Principles

1. External Identity, Internal Authorization

   Clerk manages external identity. MAIA owns internal authorization decisions through User, Tenant, Organization, Membership, ProductContext, SensitiveAccess, and audit-related domain records.

2. Tenant Isolation Comes First

   Every protected operation must resolve tenant and organization scope before accessing tenant-owned data. Tenant isolation is a prerequisite, not a downstream filter.

3. Authentication Is Not Authorization

   An authenticated session does not grant product, organization, memory, conversation, sensitive access, or administrative rights. Access requires a valid internal membership and permissions.

4. Bootstrap Must Be Idempotent

   First access, webhook retries, and read-repair flows must be safe to repeat. Duplicate users, tenants, organizations, or owner memberships must not be created by repeated events.

5. Request Boundary Must Stay Lightweight

   Request boundary logic should handle lightweight authentication routing and public/protected path decisions. It must not perform database-heavy authorization or tenant graph resolution.

6. Fail Closed

   If identity, user synchronization, tenant resolution, organization resolution, membership resolution, permissions, or webhook authenticity cannot be verified, protected access must be denied.

## Architecture

Clerk handles authentication, sessions, identity lifecycle, and provider-level user metadata.

MAIA handles internal user records, tenants, organizations, memberships, product access, auditability, sensitive access, and AI attribution.

The architecture separates identity proof from domain authority. Clerk establishes that a person or account is authenticated. MAIA determines whether that authenticated identity has access to a tenant, organization, product context, protected system, or tenant-owned record.

## Core Domain Mapping

### User

The internal User represents the MAIA domain record for a Clerk identity. It stores the stable mapping between Clerk user identity and MAIA authorization, audit, conversation, memory, sensitive access, and AI trace attribution.

The Clerk user identifier maps to the internal User through a stable external identity field. MAIA must not infer authorization from Clerk identity alone.

### Tenant

Tenant is the primary isolation boundary. Tenant-owned data must be queried, mutated, exposed, and processed only through a resolved authorization context.

Tenant scope applies to current systems and future enterprise modules, including memory, conversations, AI traces, costs, notifications, tools, events, documents, audit logs, API keys, and webhook endpoints.

### Organization

Organization is the operating workspace inside a tenant. It represents the business or operational unit through which users collaborate and access tenant-owned resources.

Organization ownership must be resolved internally. External identity metadata may assist bootstrap, but MAIA remains responsible for final organization mapping.

### Membership

Membership is the authorization entity that grants access. It connects a User to a Tenant and Organization with a role and permissions.

Protected access requires a valid membership. Missing, inactive, archived, or invalid membership state must deny access to organization-owned and tenant-owned resources.

## Identity Flow

### First Sign-In Flow

1. User authenticates with Clerk.
2. MAIA reads the authenticated Clerk session on the server.
3. MAIA resolves the internal User by Clerk user identifier.
4. If the User does not exist, MAIA performs idempotent user read-repair.
5. MAIA resolves the Tenant.
6. MAIA resolves the Organization.
7. If this is the first eligible access, MAIA bootstraps Tenant, Organization, and owner Membership transactionally.
8. MAIA resolves Membership.
9. MAIA computes authorization context.
10. Protected access is granted only when authentication and authorization both succeed.

### Webhook Synchronization Flow

Clerk webhooks synchronize identity lifecycle events into MAIA internal User records. Webhook authenticity must be verified before processing.

Lifecycle events include:

* `user.created`
* `user.updated`
* `user.deleted`

Webhook processing must be idempotent. Replayed or duplicated webhook events must not corrupt User state.

### Read-Repair Flow

Webhook delivery may be delayed, duplicated, or received out of order. Authenticated access must support idempotent user read-repair.

When a valid Clerk session exists but no internal User record is found, MAIA may create or update the internal User from trusted Clerk session data. Read-repair must not bypass tenant, organization, or membership authorization.

## Bootstrap Policy

### User Bootstrap

User bootstrap creates or updates the internal User mapped to the authenticated Clerk identity. It must be idempotent and must not create authorization by itself.

### Tenant Bootstrap

Tenant bootstrap creates the initial tenant isolation boundary when eligibility rules allow it. Tenant bootstrap must not run repeatedly for the same account or produce duplicate tenant records.

### Organization Bootstrap

Organization bootstrap creates the initial operating workspace inside the tenant. Organization bootstrap must be bound to the tenant and must not create cross-tenant access.

### Membership Bootstrap

Membership bootstrap creates the first owner membership when eligibility rules allow it. Tenant, organization, and first owner membership bootstrap must be transactional so partial bootstrap state cannot grant ambiguous access.

## Authorization Context

The authorization context is the server-resolved access object used by protected routes, services, data access, and future enterprise modules.

Conceptual type:

```ts
type AuthorizationContext = {
  userId: string;
  clerkUserId: string;
  tenantId: string;
  organizationId: string;
  membershipId: string;
  role: string;
  permissions: string[];
  isAuthenticated: boolean;
  isAuthorized: boolean;
};
```

Authorization context must be resolved server-side and never trusted from client input. Client-submitted tenant, organization, role, permission, or membership values are untrusted until verified against internal MAIA records.

## Protected Routes

### Public Routes

* `/`
* `/sign-in`
* `/sign-up`
* `/api/webhooks/clerk`

### Authentication-Protected Routes

* `/app`
* `/dashboard`
* `/onboarding`
* `/settings`
* `/api/app`
* `/api/internal`

### Authorization-Protected Routes

* AI workspace routes
* Memory routes
* Conversation routes
* Product context routes
* Sensitive access routes
* Tenant-owned settings
* Organization-owned data
* Audit log views

## Request Boundary

The request boundary may use Clerk middleware or proxy behavior depending on the Next.js version. This SPEC does not prescribe a final filename or implementation location.

The boundary is responsible only for lightweight authentication routing and public/protected path handling. It must not perform database-heavy authorization, tenant graph resolution, membership expansion, permission computation, or sensitive access checks.

## Server-Side Access Layer

MAIA requires a server-side authorization context resolver named conceptually as:

`getAuthorizationContext()`

Responsibilities:

* Read authenticated Clerk session
* Resolve internal user
* Perform read-repair if needed
* Resolve tenant
* Resolve organization
* Resolve membership
* Compute permissions
* Return authorization context
* Deny access when context cannot be resolved

This resolver is the boundary between external identity and MAIA internal authorization.

## Data Access Rule

Every tenant-owned query must include tenant or organization scoping from authorization context.

Invalid conceptual pattern:

```ts
findMemoryById(memoryId);
```

Required conceptual pattern:

```ts
findMemoryById({
  memoryId,
  tenantId: authorizationContext.tenantId,
  organizationId: authorizationContext.organizationId,
});
```

Invalid conceptual pattern:

```ts
listConversationsForUser(userId);
```

Required conceptual pattern:

```ts
listConversations({
  userId: authorizationContext.userId,
  tenantId: authorizationContext.tenantId,
});
```

Data access must not rely on client-submitted tenant or organization identifiers without server-side verification.

## Security Requirements

### Webhook Security

Clerk webhook authenticity must be verified before processing. Unverified webhook payloads must be rejected and logged as security-relevant events.

Webhook handlers must not trust payload shape, event ordering, or delivery uniqueness without validation and idempotency controls.

### Session Security

Session state must be read server-side for protected behavior. Client state must not authorize tenant, organization, role, permission, sensitive access, or product-level behavior.

### Tenant Security

Tenant-owned data access requires a resolved authorization context. Cross-tenant access is prohibited unless explicitly designed, authorized, and audited as an administrative workflow.

### Deletion Policy

Clerk user deletion must not hard-delete MAIA domain records by default. MAIA should preserve audit history, AI trace attribution, sensitive access logs, memory version history, and operational records.

Deletion events should deactivate or archive access where appropriate while preserving domain history.

### Failure Behavior

Critical access flows must fail closed. If authentication, webhook verification, user synchronization, bootstrap, tenant resolution, organization resolution, membership resolution, or permission computation fails, protected access must be denied.

## Observability Requirements

Minimum identity and authorization events to log:

* User sync created
* User sync updated
* User deactivated
* Bootstrap started
* Bootstrap completed
* Bootstrap failed
* Authorization context resolved
* Authorization context denied
* Webhook verification failed
* Webhook processing failed

Logs must not expose secrets, tokens, sensitive user payloads, or private business data.

## Error States

### Unauthenticated

The request has no valid Clerk session. Public routes remain available. Authentication-protected and authorization-protected routes must redirect or return an authentication error according to route type.

### Authenticated but Not Bootstrapped

The request has a valid Clerk session but required internal MAIA records are missing. MAIA should attempt idempotent read-repair or bootstrap when allowed. If bootstrap is not allowed or fails, access must be denied with a clear recoverable state.

### Authenticated but Not Authorized

The request has a valid Clerk session and internal User but no valid Membership or permission for the requested resource. Access must be denied. The system must not reveal tenant-owned data through error detail.

### Webhook Out of Order

Webhook events may arrive out of order. Processing must be idempotent and resilient to stale events. MAIA must avoid destructive updates when event ordering cannot be trusted.

## Implementation Plan

1. Create SPEC-001
2. Validate existing schema
3. Install Clerk SDK
4. Configure environment variables
5. Add request boundary
6. Add auth UI routes
7. Add webhook endpoint
8. Add user sync service
9. Add bootstrap service
10. Add authorization context helper
11. Validate protected routes

This document only defines the plan and does not implement it.

## Validation Criteria

Completion criteria:

* Unauthenticated users cannot access protected routes
* Authenticated users can sign in and sign out
* Clerk lifecycle events synchronize to internal users
* Webhook signatures are verified
* Missing user records can be repaired on first authenticated access
* First eligible authenticated user receives tenant, organization, and owner membership
* Authorization context resolves server-side
* Tenant-owned data access requires authorization context
* API routes reject unauthenticated requests
* Users without valid membership cannot access organization resources
* Clerk user deletion does not destroy MAIA audit history
* Logs capture identity and authorization failures without leaking secrets

## Architectural Decisions

1. Clerk Is Not the Domain Authority

   Rationale: Clerk proves external identity. MAIA must own tenant isolation, membership authorization, sensitive access, audit history, and enterprise authorization decisions.

2. Internal Membership Is Required

   Rationale: Membership is the internal authorization entity that connects User, Tenant, Organization, role, and permissions. Access cannot be inferred from Clerk authentication.

3. Bootstrap Is Transactional

   Rationale: Tenant, Organization, and first owner Membership bootstrap must succeed or fail as one operation to avoid partial state that grants ambiguous access.

4. Webhooks Are Complemented by Read-Repair

   Rationale: Webhook delivery can be delayed, duplicated, or out of order. Read-repair ensures authenticated access can safely reconcile missing internal User state without bypassing authorization.

5. Request Boundary Stays Thin

   Rationale: Heavy authorization belongs in the server-side access layer. Keeping the request boundary lightweight reduces latency, avoids hidden database work, and keeps tenant graph resolution explicit.

## Risks

* Clerk Organization misuse

  Mitigation: Treat Clerk organization metadata as external identity context only. MAIA Tenant, Organization, and Membership remain the domain authority.

* Webhook timing issues

  Mitigation: Make webhook processing idempotent and support read-repair on authenticated access.

* Authorization drift

  Mitigation: Centralize authorization context resolution and avoid duplicated permission logic.

* Overloading request boundary

  Mitigation: Keep request boundary behavior limited to lightweight authentication routing and move domain authorization into `getAuthorizationContext()`.

* Tenant leakage through unsafe queries

  Mitigation: Require tenant or organization scoping from authorization context for every tenant-owned query.

## Future Work

Future specifications should cover:

* Role and permission model
* Organization invitations
* Admin console
* Sensitive session enforcement
* Audit Layer integration
* AITrace attribution enforcement
* Cost Engine identity limits
* API key and machine authentication
* Enterprise SSO
* Organization billing integration
* Access review workflows
* User offboarding workflows

## Appendix

### Recommended Commit

`docs(spec): add identity access foundation`

### Recommended Pull Request Title

`docs(spec): add identity access foundation`

### Pull Request Summary

This PR adds SPEC-001 for the Identity & Access Foundation. It defines the planned authentication, user synchronization, bootstrap, authorization context, protected route, security, observability, and validation requirements for Clerk-backed identity and MAIA-owned authorization. It includes no implementation.
