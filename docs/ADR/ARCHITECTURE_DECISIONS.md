# Architecture Decision Records (ADR)

> **Project:** MAIA Intelligence
> **Status:** Active
> **Owner:** MAIA Engineering
> **Purpose:** Record significant architectural decisions that affect the design, implementation or long-term evolution of MAIA Intelligence.

---

# Purpose

This document serves as the official registry of architectural decisions for MAIA Intelligence.

The Blueprint defines **what MAIA is**.

The Technical Architecture defines **how MAIA works**.

The Sprint Build Specification defines **what is currently being built**.

The Architecture Decision Record (ADR) explains **why important architectural decisions were made**.

Whenever a significant architectural decision is accepted, modified or replaced, a new ADR entry must be added to this document.

Architecture history is never rewritten.

---

# Decision Process

Every ADR must include:

* Decision ID
* Date
* Status
* Context
* Decision
* Alternatives Considered
* Consequences
* Related Documents

Status values:

* Proposed
* Accepted
* Superseded
* Deprecated

---

# ADR-001

## Title

MAIA uses a Multi-Tenant Architecture.

### Status

Accepted

### Date

2026-06

### Context

MAIA is designed as a centralized intelligence platform serving multiple products, organizations and future enterprise customers.

Without strict tenant isolation, organizations could accidentally access data belonging to another tenant.

### Decision

Every business entity is tenant-scoped.

Every request must resolve tenant ownership before executing any business logic.

Cross-tenant access is prohibited unless explicitly executed through audited administrative workflows.

### Alternatives Considered

Single-tenant architecture.

Rejected because it cannot scale to multiple organizations or SaaS customers.

### Consequences

Positive

* Enterprise scalability
* Strong isolation
* Easier SaaS deployment

Negative

* Additional authorization complexity

### Related Documents

* MAIA Intelligence Blueprint v1.1
* MAIA Technical Architecture v1
* Sprint 1 Build Specification v1.1

---

# ADR-002

## Title

Sensitive Information Requires Dedicated Verification.

### Status

Accepted

### Date

2026-06

### Context

Certain information (RFC, CFDI, tax data, contracts, financial information and future regulated records) requires stronger protection than normal authentication.

### Decision

Sensitive information shall never be exposed using authentication alone.

Users must successfully verify a six-digit Sensitive Access Code before entering a temporary Sensitive Session.

Sensitive Sessions expire automatically and are fully audited.

### Alternatives Considered

JWT-only authorization.

Rejected because authentication alone is insufficient for highly sensitive business information.

### Consequences

Positive

* Strong protection for regulated information
* Reduced accidental disclosure
* Complete auditability

Negative

* Additional verification step for users

### Related Documents

* Blueprint Chapter: Security
* Technical Architecture Chapter 7
* Sprint 1 Chapter 13

---

# ADR-003

## Title

Memory is Versioned Instead of Overwritten.

### Status

Accepted

### Date

2026-06

### Context

Business intelligence depends on preserving historical knowledge.

Deleting previous versions would reduce explainability and auditability.

### Decision

Memory records are immutable.

Every update creates a new MemoryVersion.

Memory may be merged or archived but historical versions remain available for audit purposes.

### Alternatives Considered

Overwrite previous records.

Rejected because historical context would be lost.

### Consequences

Positive

* Full audit history
* Explainability
* Future learning capabilities

Negative

* Increased storage requirements

### Related Documents

* Blueprint Memory Engine
* Technical Architecture Chapter 9
* Sprint 1 Memory Foundation

---

# ADR-004

## Title

Foundation Before Intelligence.

### Status

Accepted

### Date

2026-06

### Context

Large AI projects often fail because advanced capabilities are implemented before the underlying platform becomes stable.

### Decision

Sprint 1 focuses exclusively on building the Foundation Layer.

The following capabilities are intentionally excluded:

* Voice
* WhatsApp
* Gmail
* Autonomous Agents
* RAG
* Vector Search
* Cost Engine
* Notification Engine
* Fiscal Automation

These capabilities will be introduced only after the Foundation Layer is complete.

### Alternatives Considered

Parallel development of advanced features.

Rejected because it increases technical debt and architectural instability.

### Consequences

Positive

* Stable platform
* Lower technical debt
* Predictable engineering roadmap

Negative

* Slower delivery of advanced AI features

### Related Documents

* Blueprint Roadmap
* Sprint 1 Build Specification

---

# Governance Rules

1. Architecture documents are the source of truth.
2. Every significant architectural decision requires an ADR.
3. Existing ADRs are never edited to change history.
4. If a decision changes, create a new ADR referencing the previous one.
5. Implementation must follow accepted ADRs.
6. Blueprint → Technical Architecture → Sprint Build Specification → ADRs remain synchronized.

---

# Approval

Current Architecture Status

* Blueprint v1.1 → Approved
* Technical Architecture v1 → Approved
* Sprint 1 Build Specification v1.1 → Approved

Current Engineering Status

**Ready to Begin Sprint 1 Development.**
