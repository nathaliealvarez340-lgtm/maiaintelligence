# SPEC-001 Schema Readiness Review

## Status

Draft

## Owner

MAIA Intelligence Engineering

## Overview

This document evaluates whether the current Enterprise Schema v1 can support SPEC-001 before implementation begins.

The review focuses on identity mapping, tenant and organization bootstrap, membership-based authorization, server-side authorization context, tenant isolation, auditability, soft deactivation, and future role and permission expansion.

## Reviewed Sources

The following existing files were reviewed:

* `prisma/schema.prisma`
* `docs/04-SPEC/SPEC-001-identity-access-foundation.md`
* `README.md`

`MAIA_ARCHITECTURE.md` was referenced by the task, but it does not exist in this checkout and was not reviewed.

## Review Criteria

The schema was evaluated against:

* Clerk user identity mapping
* Internal User record support
* Tenant bootstrap support
* Organization bootstrap support
* Membership bootstrap support
* Authorization context support
* Tenant isolation support
* Auditability support
* Soft deletion or account deactivation support
* Future role and permission expansion

## Model Review

### User

The User model supports the core requirements for SPEC-001.

It includes `clerkUserId String @unique`, which provides stable mapping to Clerk identity. It also includes `email String @unique`, `name String?`, `status UserStatus`, `createdAt`, `updatedAt`, and `archivedAt`.

This is sufficient for initial Clerk synchronization, read-repair, account deactivation, and audit attribution. Clerk user deletion can be represented by setting `status` to `ARCHIVED` or `SUSPENDED` and preserving historical records.

Observed gap: the model does not include a flexible profile metadata field or explicit external identity deletion timestamp. These are not required for SPEC-001 but may be useful for later identity lifecycle and compliance work.

### Tenant

The Tenant model supports the primary isolation boundary.

It includes a unique `slug`, `status`, `plan`, `createdAt`, `updatedAt`, and `archivedAt`. It owns relationships to Organization, Membership, ProductContext, Memory, SensitiveAccess, Conversation, AITrace, AuditEvent, RequestLog, and enterprise modules.

This is sufficient for Tenant bootstrap and tenant-scoped access control. Tenant lifecycle can be controlled with `status` and `archivedAt`.

Observed gap: the model does not explicitly store ownership metadata such as `createdById` or `ownerUserId`. This does not block SPEC-001 because ownership authorization can be represented through the first `Membership` with role `OWNER`, but explicit ownership metadata could improve future administrative workflows.

### Organization

The Organization model supports an operating workspace inside a tenant.

It includes `tenantId`, `name`, `type`, `status`, `createdAt`, `updatedAt`, `archivedAt`, and a required Tenant relation. The unique constraint `@@unique([tenantId, name])` supports idempotent bootstrap by tenant and organization name.

This is sufficient for internal Organization bootstrap and tenant relationship enforcement.

Observed gap: the model does not include an optional Clerk organization identifier. This does not block SPEC-001 if MAIA treats Clerk organization data as external identity context only, but it may be needed before implementing Clerk Organization synchronization or mapping.

### Membership

The Membership model supports user-to-organization authorization.

It includes `tenantId`, `organizationId`, `userId`, `role`, `permissions Json`, `createdAt`, `updatedAt`, and `archivedAt`. The unique constraint `@@unique([tenantId, organizationId, userId])` supports idempotent membership bootstrap and prevents duplicate membership rows for the same user and organization.

The model supports first owner membership bootstrap through role `OWNER` and supports future permission expansion through the `permissions` JSON field.

Observed gap: the model does not include an explicit `status` field. Active and inactive state can be inferred from `archivedAt`, but SPEC-001 describes missing, inactive, archived, or invalid membership states. A dedicated status enum would make authorization logic clearer. This is a minor follow-up, not a blocker, if implementation treats `archivedAt` as inactive.

### SensitiveAccess, SensitiveSession, SensitiveAuditLog

The sensitive access models are sufficient for future sensitive access enforcement.

SensitiveAccess is scoped by `userId` and `tenantId`, stores `codeHash`, tracks failed attempts, and includes lockout support. SensitiveSession is scoped by `userId` and `tenantId`, includes session mode, expiration, revocation, and access linkage. SensitiveAuditLog stores `userId`, `tenantId`, action, result, reason, and timestamp.

These models can support future sensitive access enforcement without implementing the sensitive PIN workflow in SPEC-001. They also preserve the architectural rule that sensitive access is separate from normal authentication.

### AITrace

AITrace supports identity and tenant attribution for future AI workflows.

It includes `requestId`, `tenantId`, optional `userId`, optional `conversationId`, `productContext`, model metadata, evaluated permissions, sensitive session usage, cost estimate, summary, and timestamp. It relates to Tenant, User, and Conversation.

This is sufficient for future AI attribution under SPEC-001. The optional `userId` relation with `onDelete: SetNull` preserves trace history if a user is deactivated or external identity is deleted.

## Authorization Context Readiness

The schema can support a server-side authorization context containing:

* `userId`
* `clerkUserId`
* `tenantId`
* `organizationId`
* `membershipId`
* `role`
* `permissions`
* `isAuthenticated`
* `isAuthorized`

User provides `id` and `clerkUserId`. Membership provides `id`, `tenantId`, `organizationId`, `userId`, `role`, and `permissions`. Tenant and Organization provide lifecycle state through `status` and `archivedAt`.

`isAuthenticated` is derived from Clerk session state, not the database. `isAuthorized` is derived from resolved User, Tenant, Organization, Membership, role, permissions, and lifecycle state.

The schema is ready for a server-side authorization context resolver. The implementation must not accept tenant, organization, role, permission, or membership values from client input without resolving them against internal records.

## Tenant Isolation Readiness

The schema is broadly tenant-ready.

Core tenant-owned models include `tenantId` and Tenant relations, including Organization, Membership, ProductContext, Memory, SensitiveAccess, SensitiveSession, SensitiveAuditLog, Conversation, AITrace, UsageRecord, CostLedger, CostBudget, CostAlert, Notification, ToolRegistry, ToolExecution, DomainEvent, OutboxEvent, WebhookDelivery, ModelProvider, ModelRoute, RoutingPolicy, RoutingDecision, ProviderUsage, KnowledgeSource, Document, DocumentChunk, DocumentEmbedding, AuditEvent, RequestLog, ApiKey, and WebhookEndpoint.

Models that depend on a parent tenant-owned record but do not directly include `tenantId` should be treated carefully. Message and MemoryVersion inherit tenant scope through Conversation and Memory respectively. This is acceptable for child records, but production data access should join through the parent or enforce parent-scoped access.

Models that may need stronger tenant or organization scoping before production use:

* Message: no direct `tenantId`; tenant scope is inherited through Conversation.
* MemoryVersion: no direct `tenantId`; tenant scope is inherited through Memory.
* Membership: has `tenantId`, but no explicit status field.
* Organization: no external provider identifier for Clerk Organization mapping.

## Gaps and Risks

### Gap 1: Organization lacks Clerk organization mapping

Impact: If implementation uses Clerk Organizations, there is no dedicated field for stable external organization mapping.

Recommendation: Do not use Clerk Organization as the domain authority in SPEC-001. If Clerk Organization synchronization becomes required, create an ADR or SPEC amendment and add a nullable, unique provider identifier conceptually such as a Clerk organization ID.

Blocks SPEC-001 implementation: No, if MAIA performs internal Organization bootstrap and does not require Clerk Organization synchronization.

### Gap 2: Membership lacks explicit active/inactive status

Impact: Authorization logic must infer inactive membership state from `archivedAt`. This is workable but less explicit than Tenant, Organization, and User lifecycle state.

Recommendation: For initial SPEC-001 implementation, treat `archivedAt` as inactive. Consider a future migration adding a Membership status enum if access review, suspension, invitation, or offboarding workflows require more state.

Blocks SPEC-001 implementation: No.

### Gap 3: User lacks profile metadata and external deletion timestamp

Impact: Clerk webhook synchronization can store core identity fields but has limited room for provider metadata or explicit deletion event tracking.

Recommendation: Use existing `status` and `archivedAt` for deletion/deactivation semantics in SPEC-001. Consider a future identity lifecycle enhancement if provider metadata becomes necessary.

Blocks SPEC-001 implementation: No.

### Gap 4: Tenant ownership metadata is represented indirectly

Impact: First owner assignment is represented through Membership role `OWNER`, not a direct Tenant owner field.

Recommendation: Use Membership as the source of authorization truth, consistent with SPEC-001. Avoid adding owner fields unless a future administrative requirement proves they are necessary.

Blocks SPEC-001 implementation: No.

### Gap 5: Child records without direct tenantId require disciplined access patterns

Impact: Message and MemoryVersion require parent-scoped joins to enforce tenant isolation. Direct lookup by child ID alone would be unsafe.

Recommendation: Data access helpers must scope child records through Conversation or Memory and the resolved authorization context.

Blocks SPEC-001 implementation: No, but it must be enforced in implementation.

## Migration Recommendation

SPEC-001 can proceed without a schema migration.

The current schema supports Clerk user identity mapping, User synchronization, Tenant bootstrap, Organization bootstrap, Membership bootstrap, server-side authorization context resolution, tenant isolation, audit attribution, and account deactivation semantics.

No migration should be created for SPEC-001 before implementation unless the implementation explicitly chooses to support Clerk Organization synchronization or explicit Membership status state in the same phase. If either is required, the migration should be described conceptually in an ADR or SPEC amendment before implementation.

## Implementation Readiness

Readiness classification: Ready with minor follow-up.

The schema supports the required SPEC-001 foundation without blocking changes. Minor follow-up items are documented for future clarity: optional Clerk Organization mapping, explicit Membership status, and richer identity lifecycle metadata.

Implementation can proceed if it treats MAIA Membership as the authorization authority, uses `archivedAt` and model status fields for lifecycle checks, and scopes all tenant-owned data through server-resolved authorization context.

## Non-Goals

This document does not implement:

* Clerk
* Authentication routes
* Webhooks
* Authorization context helper
* Prisma schema changes
* Migrations
* UI changes

## Recommended Next Step

Proceed to a controlled implementation plan for Clerk setup, keeping the request boundary lightweight and placing tenant, organization, membership, and permission resolution in a server-side authorization context helper.

Before implementation, confirm whether SPEC-001 will use Clerk Organizations. If yes, create an ADR or SPEC amendment for external organization mapping before writing code or migrations.

## Appendix

Checklist:

* User mapping reviewed
* Tenant bootstrap reviewed
* Organization bootstrap reviewed
* Membership bootstrap reviewed
* Authorization context reviewed
* Tenant isolation reviewed
* Migration need assessed
