# MAIA Intelligence Architecture

## Executive Vision

MAIA Intelligence is an independent business intelligence platform. It owns the
reasoning, context, memory, recommendation, and action contracts consumed by
future products. Consumer products integrate with MAIA Intelligence; the
platform never imports or depends on them.

The initial implementation is intentionally a modular monolith. This gives the
platform strong boundaries and a simple deployment model while preserving the
option to extract modules into services when scale or ownership requires it.

## Current Repository Analysis

The repository was empty when this architecture was created. It contained no
framework, source files, dependencies, Git metadata, or legacy constraints.

### Selected Foundation

- Next.js App Router provides the minimal developer interface and HTTP adapter.
- Strict TypeScript provides shared, compile-time contracts.
- The intelligence platform is implemented as framework-agnostic TypeScript
  under `src/intelligence`.
- Dependencies are assembled in one composition root.
- Mock implementations make the complete flow executable without credentials.

### Assumptions

- The first release is single-process and has no persistent database.
- Every request carries `tenantId` and `productId` to establish a multi-product,
  multi-tenant boundary from day one.
- Provider placeholders must fail explicitly until configured.
- Simulated actions return plans, not side effects.
- Authentication, authorization, billing, and durable storage belong to later
  phases and must be enforced before production exposure.

## Architectural Philosophy

- High cohesion inside modules and low coupling between modules.
- Domain and application logic depend on contracts, never infrastructure.
- Provider, storage, and action implementations are replaceable adapters.
- Explicit dependency injection is preferred over hidden global state.
- Strong response contracts make integrations predictable.
- Start as a modular monolith; distribute only with evidence.

## System Layers

| Layer | Initial module | Responsibility |
| --- | --- | --- |
| Presentation | `src/app` | Developer UI and HTTP request adapter |
| Intelligence | `intelligence/core` | End-to-end orchestration |
| Reasoning | `intelligence/reasoning` | Intent, domain, strategy, confidence |
| Context | `intelligence/context` | Storage-agnostic business context assembly |
| Memory | `intelligence/memory` | Business memory contracts and repositories |
| Agent | `intelligence/agents` | Discoverable domain intelligence modules |
| Action | `intelligence/actions` | Simulated and future executable actions |
| Provider | `intelligence/providers` | Replaceable model-provider abstraction |
| Infrastructure | `intelligence/composition` | Dependency assembly and adapter selection |

## Execution Flow

1. Presentation validates and submits an `IntelligenceRequest`.
2. The orchestrator asks the reasoning engine for intent, domain, and strategy.
3. The context engine builds tenant- and product-scoped business context.
4. The agent registry selects a replaceable domain agent.
5. The agent analyzes through the provider contract.
6. The action registry maps recommendations to simulated action suggestions.
7. The orchestrator emits a typed `IntelligenceResponse`.

## Core Contracts

### Intelligence Request

Every request includes an ID, tenant ID, product ID, message, and optional
context hints. Tenant and product identifiers are mandatory isolation keys.

### Intelligence Response

Every response includes:

- `agent`
- `intent`
- `summary`
- `analysis`
- `risks`
- `recommendations`
- `nextSteps`
- `confidence`

It also includes request, tenant, product, domain, and timestamp metadata for
traceability.

### Provider Contract

`AIProvider` exposes `generateResponse`, `classifyIntent`, `summarize`, and
`extractActions`. No agent, reasoning engine, or orchestrator imports a vendor
SDK. Vendor-specific request mapping belongs inside provider adapters.

### Memory Contract

`MemoryRepository` exposes save, retrieve, update, search, and delete operations.
All operations are tenant-scoped. PostgreSQL, vector, graph, and hybrid search
implementations can replace the mock without changing callers.

### Agent Contract

Every agent exposes identity, domain, capabilities, prompt templates, analysis,
recommendation, and action-suggestion behavior. `AgentRegistry` provides
discovery and routing without hard-coded construction inside the orchestrator.

### Action Contract

Every action exposes identity, description, supported domains, and an execution
method. Initial actions are simulated and return typed execution plans.

## Design Decisions

1. **Modular monolith first.** It minimizes operational overhead while contracts
   preserve future service extraction.
2. **Framework-free core.** Next.js is an adapter, not the platform boundary.
3. **Deterministic reasoning first.** Initial keyword classification is easy to
   test and can later be replaced by a model-backed classifier.
4. **Explicit composition root.** Implementations can change in one place.
5. **Mandatory tenant and product scope.** Isolation is represented in every
   core request before durable infrastructure exists.
6. **No premature agent factory.** A registry plus injected agent instances is
   sufficient until construction becomes dynamic.

## Risks

- Mock reasoning does not understand nuance and should not be presented as
  decision-grade intelligence.
- In-memory storage is process-local and loses data on restart.
- Tenant IDs are trusted input; authorization is not yet enforced.
- There is no observability, cost control, rate limiting, or audit trail.
- Provider placeholders are structural only and have no retry or fallback logic.
- A modular monolith can erode if future code bypasses contracts.

## Technical Debt Introduced

- Deterministic keyword classifiers.
- Process-local singleton composition for the developer environment.
- Simulated actions and provider behavior.
- No runtime schema-validation library at the core boundary.

These are explicit phase-one constraints, not permanent architectural choices.

## Integration Strategy

External products integrate through versioned HTTP APIs or a future typed SDK.
They send product- and tenant-scoped requests and consume the unified response
contract. Product-specific logic must live in adapters or configuration, not in
the intelligence core.

## Provider Strategy

Provider adapters map the stable `AIProvider` contract to vendor SDKs. Future
selection policy may consider capability, latency, data residency, cost, and
fallback order. Provider responses must be normalized before reaching agents.

## Memory Strategy

Memory evolves behind `MemoryRepository`:

1. Mock in-memory repository for architectural validation.
2. PostgreSQL for durable structured memory and audit records.
3. Vector search for semantic retrieval.
4. Knowledge graph for relationship-heavy reasoning.
5. Hybrid retrieval coordinated by a repository adapter.

## Future Roadmap

### Phase 2

- Add runtime request validation, authentication, and authorization.
- Add PostgreSQL memory with tenant isolation and audit history.
- Implement one production provider with retries, timeouts, and telemetry.
- Add evaluation datasets for routing and recommendation quality.
- Add structured logging, tracing, rate limits, and cost budgets.

### Phase 3

- Add semantic and graph retrieval behind the memory contract.
- Introduce policy-based provider routing and fallback.
- Add approval workflows and idempotent real action execution.
- Publish versioned SDKs and API contracts for consumer products.
- Extract services only where scale, security, or ownership proves the need.

