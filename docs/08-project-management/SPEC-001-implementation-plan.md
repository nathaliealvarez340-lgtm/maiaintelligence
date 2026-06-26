# SPEC-001 Implementation Plan: Identity & Access Foundation

## Status

Proposed

## Owner

MAIA Intelligence Engineering

## Overview

This document translates SPEC-001 into a controlled implementation plan for the Identity & Access Foundation.

Implementation must preserve MAIA's internal authorization model, tenant isolation, and enterprise architecture. Clerk is the external identity provider. MAIA Membership remains the authorization authority for tenant, organization, product-level, audit, sensitive access, AI attribution, and future enterprise access decisions.

## Inputs

The implementation plan is based on these existing repository documents:

* `docs/04-SPEC/SPEC-001-identity-access-foundation.md`
* `docs/07-research/SPEC-001-schema-readiness-review.md`
* `ENGINEERING_PHILOSOPHY.md`
* `CONTRIBUTING.md`

## Implementation Strategy

Implementation should happen in small, reviewable Pull Requests.

No single PR should install Clerk, build UI, add webhooks, add bootstrap, add authorization context, and protect routes all at once. Each implementation PR must preserve build stability, keep scope explicit, and include clear validation evidence.

The schema readiness review classified the current schema as ready with minor follow-up and stated that SPEC-001 can proceed without a schema migration. Implementation must preserve that assumption unless a separate approved decision changes the scope.

## Phase Breakdown

### Phase 0: Pre-Implementation Verification

Goals:

* Confirm current Next.js version.
* Confirm whether request boundary should use `proxy.ts` or `middleware.ts`.
* Confirm existing scripts for typecheck, lint, test, and build.
* Confirm required Clerk environment variables.
* Confirm no schema migration is required before implementation.

Deliverables:

* Documented implementation assumptions.
* No application code changes.

### Phase 1: Clerk SDK and Environment Foundation

Goals:

* Add Clerk SDK.
* Add required environment variable names to the appropriate example or documentation file.
* Do not commit secrets.
* Confirm local environment can load Clerk configuration.

Deliverables:

* Dependency added.
* Environment variable documentation updated.
* Build remains stable.

Validation:

* Dependency install succeeds.
* Existing build or typecheck remains stable.

### Phase 2: Request Boundary and Provider Setup

Goals:

* Add Clerk provider at the correct application boundary.
* Add Clerk request boundary using the correct filename for the project's Next.js version.
* Keep request boundary lightweight.
* Public routes remain public.
* Protected route groups require authentication.

Deliverables:

* Provider configured.
* Request boundary configured.
* Route protection pattern documented.

Validation:

* Public routes remain accessible.
* Protected routes redirect or deny unauthenticated access.
* Build remains stable.

### Phase 3: Authentication UI Routes

Goals:

* Add minimal sign-in and sign-up routes.
* Keep UI minimal and implementation-focused.
* Avoid product UI expansion.

Deliverables:

* Sign-in route.
* Sign-up route.
* Redirect behavior aligned with SPEC-001.

Validation:

* User can reach sign-in.
* User can reach sign-up.
* Authenticated session can be established.

### Phase 4: Clerk Webhook Endpoint

Goals:

* Add Clerk webhook endpoint.
* Verify webhook authenticity before processing.
* Support user lifecycle events:
  * `user.created`
  * `user.updated`
  * `user.deleted`
* Avoid destructive deletion of internal domain records.

Deliverables:

* Webhook route.
* Verified event handling.
* Failure behavior for invalid signatures.

Validation:

* Invalid webhook signatures are rejected.
* Supported lifecycle events are handled idempotently.
* No hard deletion of internal audit history.

### Phase 5: User Synchronization Service

Goals:

* Create dedicated user sync logic.
* Support idempotent create, update, and deactivate behavior.
* Preserve internal User as MAIA domain entity.
* Do not treat Clerk as product authorization authority.

Deliverables:

* User sync service.
* User lifecycle mapping documented in code comments or supporting docs when necessary.

Validation:

* Repeated sync does not duplicate users.
* Updated Clerk identity data updates internal user metadata safely.
* Deleted Clerk user deactivates internal user without hard deletion.

### Phase 6: Tenant, Organization, and Membership Bootstrap

Goals:

* Create transactional bootstrap logic.
* Create or resolve Tenant.
* Create or resolve default Organization.
* Create or resolve owner Membership.
* Prevent partial bootstrap states.

Deliverables:

* Bootstrap service.
* Transactional bootstrap path.
* Owner membership assignment.

Validation:

* First eligible authenticated user receives tenant, organization, and owner membership.
* Bootstrap is idempotent.
* Partial failures do not leave inconsistent authorization state.

### Phase 7: Authorization Context Resolver

Goals:

* Add server-side authorization context resolver.
* Resolve internal User, Tenant, Organization, Membership, role, and permissions.
* Support read-repair when webhook delivery is delayed.
* Deny access when context cannot be resolved.

Deliverables:

* `getAuthorizationContext()` or equivalent server-side helper.
* Fail-closed behavior.
* Tenant and organization scoped authorization result.

Validation:

* Authenticated user with membership resolves context.
* Authenticated user without membership is denied.
* Missing internal user can be repaired from Clerk identity when eligible.
* Client input cannot forge authorization context.

### Phase 8: Protected Routes and API Enforcement

Goals:

* Apply authorization context to tenant-owned routes and API surfaces.
* Ensure tenant-owned data requires server-side authorization.
* Prevent unsafe direct child record lookup for Message and MemoryVersion.

Deliverables:

* Protected route enforcement.
* API authorization checks.
* Data access patterns scoped by authorization context.

Validation:

* Unauthenticated API requests are rejected.
* Authenticated users without membership cannot access tenant resources.
* Tenant-owned records cannot be accessed across tenant boundaries.
* Child records are accessed through parent-scoped tenant checks.

### Phase 9: Observability and Audit Readiness

Goals:

* Add basic logging around identity and authorization events.
* Ensure logs avoid secrets, tokens, and sensitive payloads.
* Prepare identity events for future Audit Layer integration.

Deliverables:

* Identity and authorization event logs.
* Error states are visible in development and production diagnostics.

Validation:

* User sync events are logged.
* Bootstrap success and failure are logged.
* Authorization denial is logged without leaking sensitive data.
* Webhook verification failure is logged safely.

### Phase 10: Final Validation and Documentation Update

Goals:

* Validate end-to-end SPEC-001 behavior.
* Update relevant documentation after implementation.
* Confirm no schema migration was introduced unless separately approved.

Deliverables:

* Final validation notes.
* Documentation updates.
* Implementation summary.

Validation:

* SPEC-001 validation criteria satisfied.
* Build passes.
* Typecheck passes.
* Lint passes, if configured.
* Tests pass, if configured.
* Working tree is clean.

## Pull Request Plan

Recommended implementation split:

1. Clerk dependency and environment documentation
   * Scope: add Clerk dependency and document required environment variable names.
   * Non-goals: request boundary, UI routes, webhooks, bootstrap, authorization context.
   * Validation requirements: install succeeds, typecheck or build remains stable.
   * Risk level: Low.

2. Request boundary and provider setup
   * Scope: configure Clerk provider and lightweight request boundary for the installed Next.js version.
   * Non-goals: internal authorization, user sync, bootstrap, tenant data access.
   * Validation requirements: public routes remain public, protected routes require authentication, build remains stable.
   * Risk level: Medium.

3. Authentication UI routes
   * Scope: add minimal sign-in and sign-up routes with expected redirect behavior.
   * Non-goals: product UI expansion, dashboard redesign, role management UI.
   * Validation requirements: sign-in and sign-up routes render, session can be established.
   * Risk level: Low.

4. Webhook endpoint and user sync service
   * Scope: verify Clerk webhook signatures and synchronize user lifecycle events idempotently.
   * Non-goals: tenant bootstrap, route protection, authorization context.
   * Validation requirements: invalid signatures rejected, supported events handled, deleted users deactivated without hard deletion.
   * Risk level: High.

5. Bootstrap service
   * Scope: transactional Tenant, Organization, and owner Membership bootstrap.
   * Non-goals: role management UI, organization invitations, billing.
   * Validation requirements: idempotent first-user bootstrap, no inconsistent partial state.
   * Risk level: High.

6. Authorization context resolver
   * Scope: implement server-side authorization context resolution and read-repair.
   * Non-goals: broad route enforcement, API refactors, sensitive PIN workflow.
   * Validation requirements: authorized users resolve context, users without membership are denied, client input cannot forge context.
   * Risk level: High.

7. Protected routes and API enforcement
   * Scope: apply authorization context to tenant-owned routes, APIs, and child record access patterns.
   * Non-goals: UI redesign, AI execution, memory policy expansion.
   * Validation requirements: unauthenticated and unauthorized access denied, cross-tenant access blocked, Message and MemoryVersion access parent-scoped.
   * Risk level: High.

8. Observability and documentation updates
   * Scope: add safe identity and authorization logs and update relevant documentation.
   * Non-goals: full Audit Layer implementation, analytics expansion, incident platform integration.
   * Validation requirements: identity events logged safely, denial and webhook failures visible without exposing secrets.
   * Risk level: Medium.

## Validation Matrix

| Capability | Validation Method | Expected Result | Blocking Severity |
| --- | --- | --- | --- |
| Clerk session creation | Manual authentication flow and server session check | Valid session is established for authenticated user | High |
| Public route access | Manual route review | Public routes remain accessible without authentication | Medium |
| Protected route access | Manual route review and request checks | Unauthenticated requests redirect or deny access | High |
| Webhook signature verification | Invalid and valid webhook payload tests | Invalid signatures rejected; valid signatures processed | High |
| User sync idempotency | Repeat same lifecycle event | No duplicate internal users | High |
| Tenant bootstrap | First eligible authenticated access | Tenant is created or resolved | High |
| Organization bootstrap | First eligible authenticated access | Organization is created or resolved inside tenant | High |
| Owner membership bootstrap | First eligible authenticated access | Owner Membership is created or resolved | High |
| Authorization context resolution | Server-side resolver tests | Context includes user, tenant, organization, membership, role, permissions | High |
| Authorization denial | Authenticated user without membership | Access is denied fail-closed | High |
| Tenant isolation | Cross-tenant access attempts | Tenant-owned data is not exposed across tenant boundaries | Critical |
| Child record tenant scoping | Message and MemoryVersion lookup review | Child records are accessed through parent tenant checks | Critical |
| Account deactivation | Clerk user deletion event | Internal User is deactivated without hard deletion of domain history | High |
| Logging safety | Manual log review | Logs exclude tokens, secrets, sensitive payloads, and private business data | High |

## Security Checklist

* No secrets committed
* Clerk session used only for identity
* MAIA Membership used for authorization
* Authorization resolved server-side
* Tenant-owned data scoped by authorization context
* Child records scoped through parent tenant checks
* Webhook signatures verified
* Deleted Clerk users do not hard-delete MAIA domain history
* Critical failures deny access
* Logs do not expose tokens or sensitive payloads

## Risks and Mitigations

* Request boundary filename mismatch
  * Mitigation: confirm installed Next.js and Clerk conventions in Phase 0 before adding the boundary. Use the correct convention for the installed version.

* Treating Clerk Organizations as MAIA tenant authority
  * Mitigation: keep MAIA Tenant, Organization, and Membership as the domain authority. Use Clerk organization data only as external identity context unless an ADR or SPEC amendment changes that scope.

* Relying only on webhooks for onboarding
  * Mitigation: implement read-repair for authenticated access when webhook delivery is delayed.

* Duplicated authorization logic
  * Mitigation: centralize tenant, organization, membership, role, and permission resolution in the server-side authorization context helper.

* Unsafe child record lookups
  * Mitigation: access Message through Conversation tenant scope and MemoryVersion through Memory tenant scope. Do not fetch child records by ID alone in protected flows.

* Overloading request boundary
  * Mitigation: keep request boundary limited to lightweight authentication routing. Perform database-heavy authorization in server-side access helpers.

* Secrets committed accidentally
  * Mitigation: document environment variable names only and review diffs for secret values before PR.

* Partial bootstrap states
  * Mitigation: implement Tenant, Organization, and owner Membership bootstrap transactionally and idempotently.

## Non-Goals

This plan does not implement:

* Clerk
* Authentication routes
* Webhooks
* User sync service
* Bootstrap service
* Authorization context helper
* Protected routes
* UI redesign
* Billing
* AI execution
* Memory policy enforcement
* Sensitive PIN workflow

## Recommended Next Step

Begin with Phase 0 as a documentation and verification task before installing Clerk.

Phase 0 should confirm the installed Next.js version, request boundary convention, existing validation scripts, required Clerk environment variable names, and the no-migration assumption from the schema readiness review.

## Appendix

### Recommended Commit

`docs(project-management): add identity access implementation plan`

### Recommended Pull Request Title

`docs(project-management): add identity access implementation plan`

### Pull Request Summary

This PR adds the implementation plan for SPEC-001: Identity & Access Foundation. It defines phased delivery, PR sequencing, validation requirements, security checks, risks, and mitigations. It includes no application code.
