# CONTRIBUTING

## Overview

MAIA Intelligence is an enterprise-grade AI operating platform. Contributions must preserve maintainability, security, architecture clarity, observability, and multi-tenant correctness.

This repository is not a place for undocumented implementation, speculative redesign, or broad unrelated changes. Every change should be scoped, reviewable, validated, and aligned with the approved architecture.

## Contribution Principles

Contributors must follow these principles:

* Understand the architecture before changing code.
* Prefer explicit design over implicit behavior.
* Keep tenant boundaries intact.
* Avoid quick hacks.
* Keep business logic out of UI components.
* Document important decisions.
* Validate before opening a Pull Request.
* Keep changes scoped.

## Development Workflow

Significant work must follow this lifecycle:

1. Understand the task
2. Review relevant architecture documents
3. Create research notes or RFC when necessary
4. Create ADR when architecture changes
5. Create or update SPEC for major systems
6. Implement the change
7. Validate locally
8. Open Pull Request
9. Address review
10. Merge
11. Update documentation if necessary

Major systems must not be implemented before design. Design work prevents architecture drift, unclear ownership, and long-term maintenance debt.

## Branching Standards

Branch names must describe the type and scope of the work.

Acceptable examples:

* `feat/identity-access-foundation`
* `feat/memory-service`
* `docs/spec-001-identity-access`
* `refactor/authorization-context`
* `chore/repository-governance`

Vague branch names are not acceptable:

* `changes`
* `updates`
* `fix`
* `new-stuff`

## Commit Standards

The repository uses Conventional Commits. Commit messages must describe the intent and scope of the change.

Acceptable examples:

* `feat(auth): add clerk request boundary`
* `feat(memory): add memory versioning service`
* `docs(spec): add identity access foundation`
* `docs(architecture): update tenant model overview`
* `refactor(core): isolate authorization context`
* `test(memory): add memory service tests`
* `chore(ci): update validation workflow`

Vague commits are not acceptable:

* `update`
* `fix stuff`
* `changes`
* `new version`
* `final`

## Pull Request Standards

Every Pull Request must use `.github/PULL_REQUEST_TEMPLATE.md`.

Pull Requests must describe:

* Overview
* Architecture Scope
* Design Principles
* Architectural Decisions
* Major Components
* Validation
* Migration, if applicable
* Security Review
* Observability
* Non-Goals
* Expected Outcome
* Reviewer Notes

PRs must make the reasoning behind a change visible, not only the code diff.

## Documentation Standards

Documentation belongs in the correct location:

* Architecture documents: `docs/01-architecture/`
* ADRs: `docs/02-ADR/`
* RFCs: `docs/03-RFC/`
* SPECs: `docs/04-SPEC/`
* Standards: `docs/05-standards/`
* Diagrams: `docs/06-diagrams/`
* Research: `docs/07-research/`
* Project management: `docs/08-project-management/`
* Decisions: `docs/09-decisions/`
* Archived documents: `docs/archive/`

Documentation must be updated when behavior, architecture, system boundaries, security assumptions, or operational expectations change.

## Code Standards

Production-grade code must be clear, typed, and reviewable.

Contributors must:

* Use TypeScript deliberately.
* Keep module boundaries clear.
* Keep business logic in services or domain modules.
* Avoid duplicating authorization logic.
* Avoid tenant-unsafe queries.
* Avoid hidden side effects.
* Avoid premature abstraction.
* Avoid large unrelated changes.
* Keep code reviewable.

## Security Standards

Authentication is not authorization. Server-side authorization is required for protected behavior.

Tenant-owned data must require a resolved authorization context before it is queried, mutated, exposed, or processed. Client state must not be trusted for authorization.

Secrets must never be committed. Sensitive data must be handled explicitly, critical flows must fail closed, and security-sensitive changes require careful review.

## Database and Migration Standards

Prisma and database changes must be intentional and reviewable.

Contributors must ensure:

* Schema changes are intentional.
* Migrations are reviewed.
* Migration impact is documented in PRs.
* Tenant isolation is preserved.
* Backward compatibility is considered.
* Destructive changes have explicit justification.
* Production data assumptions are documented.

## AI Agent Contribution Rules

AI coding agents must follow the same contribution standards as human contributors.

AI agents must:

* Follow existing architecture.
* Avoid redesigning approved systems without instruction.
* Modify only files required for the task.
* Explain changes clearly.
* Avoid adding packages unless explicitly requested.
* Avoid touching environment files unless explicitly requested.
* Avoid implementing beyond scope.
* Preserve documentation and commit standards.

## Validation Before PR

Before opening a Pull Request, contributors should validate the change using the existing project scripts and relevant tooling.

Checklist:

* `git status`
* Typecheck
* Lint
* Tests, if applicable
* Build, if applicable
* Prisma validation, if schema changed
* Manual review of changed files
* Confirm no secrets were committed
* Confirm no unrelated files were modified

Do not invent package scripts. Use the scripts and commands already present in the project.

## Non-Negotiables

* No major implementation without SPEC
* No architecture change without ADR
* No tenant-owned data access without authorization context
* No secrets in code
* No production authorization based only on client state
* No silent failure in critical flows
* No unrelated changes in a PR
* No vague commits
* No undocumented critical decisions

## Maintainer Review Expectations

Maintainers should review:

* Scope control
* Architecture consistency
* Security impact
* Tenant isolation
* Migration safety
* Documentation completeness
* Validation evidence
* Operational impact

## Future Updates

This document may evolve as MAIA Intelligence matures. Changes must be documented and reviewed with the same discipline as other repository governance changes.
