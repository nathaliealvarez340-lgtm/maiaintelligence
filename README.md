# MAIA Intelligence

> **Enterprise Intelligence Operating System**
> Build businesses that think, remember and operate intelligently.

---

# Overview

MAIA Intelligence is the core intelligence platform of the MAIA ecosystem.

It is not a chatbot.

It is not an AI wrapper.

It is the centralized intelligence layer responsible for memory, reasoning, permissions, contextual understanding and controlled execution across every MAIA product.

Current products include:

* MAIA Core
* Mikaelson OS
* OFF
* Orbit
* Future MAIA Products

Every product connects to the same intelligence core while maintaining complete tenant isolation and product-specific behavior.

---

# Architecture Documents

The project is governed by three architecture documents.

They must always be read in the following order.

## 1. MAIA Intelligence Blueprint v1.1

Purpose:

Defines product vision, intelligence model, governance rules and long-term architecture.

Questions it answers:

* What is MAIA?
* Why does it exist?
* What should it become?
* What capabilities belong to each authority level?

---

## 2. MAIA Technical Architecture v1

Purpose:

Defines the engineering architecture.

Questions it answers:

* How does MAIA work?
* Security model
* Multi-tenant architecture
* Memory engine
* Event engine
* Cost engine
* Notification engine
* APIs
* Infrastructure

---

## 3. MAIA Sprint 1 Build Specification v1.1

Purpose:

Defines exactly what must be built during Sprint 1.

Questions it answers:

* What is implemented?
* What is intentionally excluded?
* Repository structure
* Database model
* API contracts
* Acceptance criteria

---

# Document Hierarchy

Blueprint

↓

Technical Architecture

↓

Sprint Build Specification

↓

Engineering

↓

Production

No implementation should contradict a document above it.

---

# Current Status

| Layer                        | Status           |
| ---------------------------- | ---------------- |
| Product Vision               | ✅ Approved       |
| Technical Architecture       | ✅ Approved       |
| Sprint 1 Build Specification | ✅ Approved       |
| Sprint 1 Development         | ⏳ Ready to Start |

---

# Sprint Roadmap

## Sprint 1

Foundation Layer

* Repository
* Authentication
* Multi-Tenant
* Permissions
* Sensitive Access
* Memory Foundation
* Chat Foundation

---

## Sprint 2

Knowledge Layer

* Documents
* Chunking
* Embeddings
* Vector Database
* Retrieval
* Citations

---

## Sprint 3

Execution Layer

* Tool Registry
* Action Engine
* Events
* Notifications
* Webhooks

---

## Sprint 4

Intelligence Layer

* Model Router
* Cost Engine
* Audit Intelligence
* Optimization
* Multi-model orchestration

---

# Engineering Principles

Every engineering decision must follow these principles.

1. Security First
2. Tenant First
3. Memory First
4. Least Privilege
5. Audit Everything
6. Fail Safely
7. Build Foundation Before Features

---

# Technology Stack

Frontend

* Next.js
* React
* TypeScript
* TailwindCSS

Backend

* Next.js Route Handlers

Database

* PostgreSQL
* Prisma
* Neon

Authentication

* Clerk

Storage

* Cloudflare R2

AI

* OpenAI

Deployment

* Vercel

Observability

* Sentry
* PostHog

---

# Repository Structure

```
maia-intelligence/

apps/
    web/

packages/
    ai/
    core/
    database/
    types/

docs/

.github/

scripts/
```

---

# Development Rules

* Never bypass Tenant Guard.
* Never expose sensitive data without an active Sensitive Session.
* Never store secrets in plaintext.
* Never execute tools without permission validation.
* Never merge directly into production.
* Every feature must generate audit events.
* Every database change requires a migration.

---

# Branch Strategy

```
main
│
develop
│
feature/*
│
hotfix/*
```

---

# Commit Convention

```
feat:

fix:

refactor:

docs:

test:

perf:

chore:
```

Examples

```
feat(memory): add MemoryVersion model

fix(auth): validate tenant membership

docs(sprint1): update ERD

refactor(api): simplify context resolver
```

---

# Code Standards

* Strict TypeScript
* ESLint
* Prettier
* Zero `any`
* Small reusable modules
* Dependency injection where applicable
* Server-side authorization only

---

# Security Rules

Every request must validate:

1. Authentication
2. Tenant
3. Membership
4. Permissions
5. Sensitive Session (when applicable)

Failure at any step immediately terminates execution.

---

# Architecture Rule

If implementation conflicts with architecture:

**Architecture wins.**

The implementation must be corrected.

The architecture documents may only change after an approved architecture review.

---

# Definition of Success

Sprint 1 is complete when MAIA Core can:

* Authenticate users.
* Resolve tenant context.
* Validate permissions.
* Protect sensitive information.
* Store governed memory.
* Maintain conversations.
* Produce audit logs.
* Respond through contextual chat.

No additional capabilities should be implemented before Sprint 1 completion.

---

# Project Vision

MAIA is being built as an enterprise intelligence operating system capable of powering every product within the MAIA ecosystem through a shared intelligence core, governed memory, secure execution and scalable architecture.

Foundation first.

Intelligence second.

Automation third.

Scale forever.
