# SPEC-001 Phase 0: Pre-Implementation Verification

## Status

Draft

## Owner

MAIA Intelligence Engineering

## Overview

This document verifies the current repository state before beginning SPEC-001 implementation.

Phase 0 exists to reduce implementation risk and avoid incorrect assumptions before Clerk setup. It records the actual runtime, scripts, routing structure, environment file state, schema readiness, and implementation assumptions present in the repository before Phase 1 begins.

## Reviewed Sources

The following existing files and directories were reviewed:

* `package.json`
* `next.config.ts`
* `tsconfig.json`
* `prisma/schema.prisma`
* `README.md`
* `ENGINEERING_PHILOSOPHY.md`
* `CONTRIBUTING.md`
* `docs/04-SPEC/SPEC-001-identity-access-foundation.md`
* `docs/07-research/SPEC-001-schema-readiness-review.md`
* `docs/08-project-management/SPEC-001-implementation-plan.md`
* `src/`
* `src/app/`
* `src/intelligence/`

`MAIA_ARCHITECTURE.md` was not reviewed because it was not found in this checkout.

## Runtime and Framework Verification

Current versions from `package.json`:

* Next.js: `^16.1.6`
* React: `^19.2.4`
* TypeScript: `^5.9.0`
* Prisma CLI: `^7.8.0`
* Prisma Client: `^7.8.0`

Package manager indicated by repository files:

* `pnpm` is indicated by `pnpm-lock.yaml` and `pnpm-workspace.yaml`.

Router structure:

* The project appears to use the App Router.
* `src/` exists.
* `src/app/` exists.
* `pages/` was not found during reviewed structure checks.
* Project-level `middleware.ts` was not found.
* Project-level `proxy.ts` was not found.
* No `middleware.ts` or `proxy.ts` file was found under `src/`.

## Request Boundary Recommendation

Implementation requires verification before deciding the final request boundary filename.

The project uses Next.js `^16.1.6`, and SPEC-001 guidance notes that newer Clerk and Next.js documentation may reference `proxy.ts`, while Next.js 15 and earlier may require `middleware.ts`. Because no existing request boundary file is present, Phase 1 or Phase 2 must confirm the correct convention against the installed Next.js and Clerk versions before creating the file.

The request boundary must remain lightweight. It should handle public/protected routing and authentication checks only. It must not perform tenant graph resolution, membership expansion, permission computation, heavy Prisma access, or sensitive access checks.

## Existing Scripts

Available scripts from `package.json`:

* `dev`: `next dev`
* `build`: `next build`
* `start`: `next start`
* `lint`: `eslint .`
* `typecheck`: `tsc --noEmit`
* `test`: `vitest run`

Script usage:

* Development: `dev`
* Build: `build`
* Lint: `lint`
* Typecheck: `typecheck`
* Tests: `test`
* Prisma validation or generation: no package script was found for Prisma validation or generation.

Prisma validation and generation are available through Prisma tooling, but no dedicated package scripts currently exist for those tasks.

## Environment Variable Readiness

Environment files found:

* `.env.example`
* `.env`
* `.env.local`
* `.env.development.local`

Secret values were not printed or inspected.

Clerk environment variable names likely required during implementation:

* `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
* `CLERK_SECRET_KEY`
* `CLERK_WEBHOOK_SECRET`

These names will need to be documented or configured during implementation. Secrets must never be committed to the repository.

## Schema Readiness Confirmation

`docs/07-research/SPEC-001-schema-readiness-review.md` classifies the schema as:

Ready with minor follow-up.

The readiness review concludes that SPEC-001 can proceed without a Prisma migration. It confirms that Clerk user identity mapping, User synchronization, Tenant bootstrap, Organization bootstrap, Membership bootstrap, server-side authorization context resolution, tenant isolation, audit attribution, and account deactivation semantics are supported by the current schema.

No Prisma schema change or migration is required before beginning Clerk implementation, unless implementation scope changes to require Clerk Organization synchronization or explicit Membership status state in the same phase.

## Application Structure Review

Relevant current `src/` structure:

* `src/app/`
* `src/generated/`
* `src/intelligence/`

Relevant `src/app/` files:

* `src/app/layout.tsx`
* `src/app/page.tsx`
* `src/app/globals.css`

Relevant future implementation areas:

* App layout or provider boundary: likely under `src/app/layout.tsx`.
* Route handlers: no current API route handler directory was found during reviewed structure checks.
* Server utilities: likely under future server-only modules, or existing `src/intelligence/` modules when aligned with ownership.
* Lib or services directory: no root `src/lib/` or `src/services/` directory was found.
* API routes: no current `src/app/api/` directory was found.
* Authentication and authorization domain modules already exist under `src/intelligence/authentication/` and `src/intelligence/authorization/`.

No files or directories were created or modified for application structure during this verification.

## Implementation Assumptions

Assumptions before Phase 1 begins:

* Clerk will be the identity provider only.
* MAIA database records remain the authorization authority.
* MAIA Membership remains the source of authorization for tenant and organization access.
* User synchronization will be idempotent.
* Tenant, Organization, and owner Membership bootstrap will be transactional.
* Authorization context will be resolved server-side.
* Tenant-owned queries will require authorization context.
* Message and MemoryVersion access will be scoped through parent tenant checks.
* Clerk webhooks will be verified before processing.
* Webhooks will not be treated as synchronous onboarding dependencies.
* Read-repair will exist for authenticated access when webhook delivery is delayed.
* No schema migration is required before Phase 1.

## Risks Before Implementation

### Request boundary filename mismatch

Impact: Creating the wrong boundary file could leave routes unprotected or cause framework-level behavior to be ignored.

Mitigation: Verify the correct convention for the installed Next.js and Clerk versions before creating `proxy.ts` or `middleware.ts`.

Blocking status: Follow-up required before Phase 2.

### Missing typecheck or test scripts

Impact: Missing validation scripts would reduce confidence during incremental implementation.

Mitigation: Existing `typecheck` and `test` scripts are present. Prisma validation and generation scripts are missing, so Prisma checks should be run through existing Prisma tooling if schema-related work is introduced later.

Blocking status: Not blocking Phase 1.

### Environment variables not documented

Impact: Clerk setup could fail or encourage unsafe local configuration if variable names are not documented.

Mitigation: Document required Clerk variable names during Phase 1 without committing values.

Blocking status: Not blocking Phase 1.

### Accidental secret exposure

Impact: Committed Clerk keys or webhook secrets would create a security incident.

Mitigation: Do not print or commit secret values. Review diffs for `.env` and secret-like values before opening a PR.

Blocking status: Not blocking if controls are followed.

### Overloading request boundary

Impact: Heavy Prisma access or tenant graph resolution in the request boundary can increase latency, obscure authorization behavior, and create maintenance risk.

Mitigation: Keep the boundary limited to authentication routing. Resolve tenant, organization, membership, and permissions in server-side helpers.

Blocking status: Not blocking if enforced in implementation.

### Unsafe child record lookup

Impact: Direct lookup by Message ID or MemoryVersion ID can bypass tenant checks if not joined through Conversation or Memory.

Mitigation: Require parent-scoped tenant checks for child records and centralize access patterns in data access helpers.

Blocking status: Not blocking Phase 1, but blocking protected data access completion if unresolved.

### Authorization logic duplication

Impact: Repeated authorization logic across routes and services can drift and create inconsistent access behavior.

Mitigation: Implement a single server-side authorization context resolver and require protected surfaces to use it.

Blocking status: Not blocking Phase 1.

### Partial bootstrap state

Impact: Failed bootstrap could create Tenant or Organization records without a valid owner Membership, leaving ambiguous authorization state.

Mitigation: Implement Tenant, Organization, and owner Membership bootstrap transactionally and idempotently.

Blocking status: Not blocking Phase 1, but blocking bootstrap completion if unresolved.

## Phase 0 Outcome

Ready for Phase 1 with follow-up.

The repository has a compatible foundation for Phase 1. Next.js, React, TypeScript, Prisma, pnpm, App Router structure, validation scripts, environment file names, and schema readiness have been verified. No Prisma migration is required before Clerk implementation begins.

Follow-up is required before request boundary implementation to confirm whether the correct boundary file is `proxy.ts` or `middleware.ts` for the installed Next.js and Clerk versions.

## Recommended Next Step

Proceed to Phase 1: Clerk SDK and Environment Foundation.

Before creating a request boundary in Phase 2, verify the correct Next.js and Clerk convention for `proxy.ts` versus `middleware.ts`.

## Non-Goals

This document does not implement:

* Clerk SDK installation
* Authentication UI routes
* Request boundary
* Webhooks
* User synchronization service
* Tenant bootstrap service
* Authorization context helper
* Protected routes
* Prisma schema changes
* Migrations
* Environment file modifications

## Appendix

Checklist:

* Next.js version reviewed
* Existing scripts reviewed
* Request boundary files checked
* Environment files checked without exposing secrets
* Schema readiness reviewed
* Application structure reviewed
* Risks documented
* Phase 1 readiness classified
