import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { DefaultActionRegistry } from "../actions/action-registry";
import { simulatedActions } from "../actions/simulated-actions";
import { DefaultAgentRegistry } from "../agents/agent-registry";
import { createInitialAgents } from "../agents/initial-agents";
import { TraceService } from "../audit/trace-service";
import type { AuthorizedContext, UnauthorizedContext } from "../authorization/authorization-context";
import type { AuthorizationResolver } from "../authorization/authorization-resolver";
import { ContextComposer } from "../composition/context-composer";
import { BusinessContextEngine } from "../context/context-engine";
import type { IntelligenceRequest } from "../contracts/types";
import { MockMemoryRepository } from "../memory/mock-memory-repository";
import { MockProvider } from "../providers/mock-provider";
import { DeterministicReasoningEngine } from "../reasoning/reasoning-engine";
import { ReasoningPipeline } from "../reasoning/reasoning-pipeline";
import type { MaiaCore } from "./maia-core";
import { MaiaIntelligence } from "./maia-intelligence";

// Forward production aliases to real modules in the repository's Vitest setup.
vi.mock("@/intelligence/composition/context-composer", async () =>
  import("../composition/context-composer"),
);
vi.mock("@/intelligence/context/product-contexts", async () =>
  import("../context/product-contexts"),
);
vi.mock("@/intelligence/audit/trace-service", async () =>
  import("../audit/trace-service"),
);
vi.mock("@/intelligence/shared/ids", async () => import("../shared/ids"));
vi.mock("@/intelligence/shared/errors", async () => import("../shared/errors"));
vi.mock("@/intelligence/reasoning/reasoning-pipeline", async () =>
  import("../reasoning/reasoning-pipeline"),
);

const authorization: AuthorizedContext = {
  userId: "user_authorized",
  clerkUserId: "clerk_authorized",
  tenantId: "tenant_authorized",
  organizationId: "organization_authorized",
  membershipId: "membership_authorized",
  role: "MANAGER",
  permissions: ["chat:use", "memory:read", "reports:export"],
  isAuthenticated: true,
  isAuthorized: true,
};

const request: IntelligenceRequest = {
  requestId: "request_1",
  productContext: "maia",
  message: "Analyze current strategy",
};

const createRuntime = (
  resolveAuthorization: AuthorizationResolver = async () => authorization,
) => {
  const resolveAuthorizationSpy = vi.fn(resolveAuthorization);
  const memory = new MockMemoryRepository();
  const search = vi.spyOn(memory, "search");
  const context = new BusinessContextEngine(memory);
  const build = vi.spyOn(context, "build");
  const provider = new MockProvider();
  const generateResponse = vi.spyOn(provider, "generateResponse");
  const reasoning = new DeterministicReasoningEngine(provider);
  const reason = vi.spyOn(reasoning, "reason");
  const pipeline = new ReasoningPipeline(provider);
  const run = vi.spyOn(pipeline, "run");
  const composer = new ContextComposer();
  const compose = vi.spyOn(composer, "compose");
  const traces = new TraceService();
  const createTrace = vi.spyOn(traces, "createTrace");
  const actions = simulatedActions.map((action) => ({
    ...action,
    execute: vi.fn(action.execute),
  }));
  const core = new MaiaIntelligence(
    reasoning,
    context,
    new DefaultAgentRegistry(createInitialAgents()),
    new DefaultActionRegistry(actions),
    pipeline,
    composer,
    traces,
    resolveAuthorizationSpy,
  );

  return {
    core, search, build, generateResponse, reason, run, compose, traces, createTrace, actions,
    resolveAuthorization: resolveAuthorizationSpy,
  };
};

describe("MAIA runtime authorization", () => {
  it("accepts only business request data at the public execution boundary", () => {
    expectTypeOf<Parameters<MaiaCore["execute"]>>().toEqualTypeOf<[
      IntelligenceRequest,
    ]>();
    expectTypeOf<Parameters<MaiaIntelligence["execute"]>>().toEqualTypeOf<[
      IntelligenceRequest,
    ]>();
    expectTypeOf<Extract<
      keyof IntelligenceRequest,
      "tenantId" | "userId" | "clerkUserId" | "organizationId" | "membershipId" | "role" | "permissions" | "authorization"
    >>().toEqualTypeOf<never>();
  });

  it("preserves canonical identities, role, and all Membership permissions", async () => {
    const runtime = createRuntime();

    const response = await runtime.core.execute(request);

    expect(runtime.resolveAuthorization).toHaveBeenCalledExactlyOnceWith();
    expect(runtime.resolveAuthorization.mock.invocationCallOrder[0]).toBeLessThan(
      runtime.reason.mock.invocationCallOrder[0],
    );
    expect(runtime.build).toHaveBeenCalledWith(request, authorization);
    expect(runtime.compose.mock.calls[0][0].request).toEqual({
      requestId: request.requestId,
      tenantId: authorization.tenantId,
      user: { id: authorization.userId, clerkUserId: authorization.clerkUserId },
      membershipId: authorization.membershipId,
      organization: { id: authorization.organizationId, tenantId: authorization.tenantId },
      role: authorization.role,
      permissions: authorization.permissions,
      productContext: request.productContext,
      sensitiveAccess: "none",
    });
    expect(runtime.run.mock.calls[0][1].package.sensitiveSessionState).toEqual({
      accessLevel: "none",
      allowed: false,
    });
    expect(response.tenantId).toBe(authorization.tenantId);
    expect(runtime.traces.getTrace(response.traceId!)?.tenantId).toBe(authorization.tenantId);
  });

  it("ignores payload authority claims throughout tenant-owned execution", async () => {
    const runtime = createRuntime();
    const payload = {
      ...request,
      tenantId: "tenant_attacker_target",
      userId: "user_attacker_target",
      clerkUserId: "clerk_attacker_target",
      organizationId: "organization_attacker_target",
      membershipId: "membership_attacker_target",
      role: "OWNER",
      permissions: ["audit:read"],
      contextHints: {
        company: { name: "Request company" },
        tenantId: "tenant_attacker_target",
        userId: "user_attacker_target",
        organizationId: "organization_attacker_target",
        membershipId: "membership_attacker_target",
        role: "OWNER",
        permissions: ["audit:read"],
        productContext: "orbit",
        productId: "product_attacker_target",
        sensitiveAccess: "full",
      },
    };

    const response = await runtime.core.execute(payload);

    expect(runtime.resolveAuthorization).toHaveBeenCalledExactlyOnceWith();
    expect(runtime.search).toHaveBeenCalledExactlyOnceWith({
      tenantId: authorization.tenantId,
      productId: request.productContext,
      type: "business-context",
    });
    const composed = runtime.compose.mock.calls[0][0];
    expect(composed.request).toMatchObject({
      tenantId: authorization.tenantId,
      user: { id: authorization.userId, clerkUserId: authorization.clerkUserId },
      organization: { id: authorization.organizationId },
      membershipId: authorization.membershipId,
      role: authorization.role,
      permissions: authorization.permissions,
      sensitiveAccess: "none",
    });
    expect(composed.businessContext).toMatchObject({
      tenantId: authorization.tenantId,
      productContext: request.productContext,
      productId: request.productContext,
      company: { name: "Request company" },
    });
    for (const key of ["userId", "organizationId", "membershipId", "role", "permissions", "sensitiveAccess"]) {
      expect(composed.businessContext).not.toHaveProperty(key);
    }
    expect(runtime.generateResponse.mock.calls[0][0].context).toBe(composed.businessContext);
    expect(runtime.run.mock.calls[0][1].businessContext).toBe(composed.businessContext);
    const executedActions = runtime.actions.flatMap((action) => action.execute.mock.calls);
    expect(executedActions).toHaveLength(1);
    expect(executedActions[0][1]).toBe(composed.businessContext);
    expect(response.tenantId).toBe(authorization.tenantId);
    expect(runtime.createTrace.mock.calls[0][0].tenantId).toBe(authorization.tenantId);
    expect(runtime.traces.getTrace(response.traceId!)?.tenantId).toBe(authorization.tenantId);
  });

  it("rejects a malformed resolver result before any execution begins", async () => {
    const malformedResolver = (async () => undefined) as unknown as AuthorizationResolver;
    const runtime = createRuntime(malformedResolver);

    await expect(runtime.core.execute(request)).rejects.toMatchObject({
      code: "AUTHORIZATION_CONTEXT_REQUIRED",
      status: 403,
    });
    expect(runtime.reason).not.toHaveBeenCalled();
    expect(runtime.build).not.toHaveBeenCalled();
    expect(runtime.search).not.toHaveBeenCalled();
    expect(runtime.run).not.toHaveBeenCalled();
    expect(runtime.compose).not.toHaveBeenCalled();
    expect(runtime.createTrace).not.toHaveBeenCalled();
    runtime.actions.forEach((action) => expect(action.execute).not.toHaveBeenCalled());
  });

  it.each([
    "UNAUTHENTICATED",
    "MEMBERSHIP_NOT_FOUND",
    "USER_READ_REPAIR_FAILED",
    "BOOTSTRAP_FAILED",
  ] as const)("rejects resolver denial %s before runtime execution", async (reason) => {
    const isAuthenticated = reason !== "UNAUTHENTICATED";
    const denied: UnauthorizedContext = {
      userId: null,
      clerkUserId: isAuthenticated ? "clerk_denied" : null,
      tenantId: null,
      organizationId: null,
      membershipId: null,
      role: null,
      permissions: [],
      isAuthenticated,
      isAuthorized: false,
      reason,
    };
    const runtime = createRuntime(async () => denied);

    await expect(runtime.core.execute(request)).rejects.toMatchObject({
      code: isAuthenticated ? "AUTHORIZATION_CONTEXT_REQUIRED" : "UNAUTHENTICATED",
      status: isAuthenticated ? 403 : 401,
    });
    expect(runtime.reason).not.toHaveBeenCalled();
    expect(runtime.build).not.toHaveBeenCalled();
    expect(runtime.search).not.toHaveBeenCalled();
    expect(runtime.run).not.toHaveBeenCalled();
    expect(runtime.compose).not.toHaveBeenCalled();
    expect(runtime.createTrace).not.toHaveBeenCalled();
    runtime.actions.forEach((action) => expect(action.execute).not.toHaveBeenCalled());
  });

  it("does not grant chat permission from a role or default permission list", async () => {
    const runtime = createRuntime(async () => ({
      ...authorization,
      role: "OWNER",
      permissions: [],
    }));

    await expect(runtime.core.execute(request))
      .rejects.toMatchObject({ code: "PERMISSION_DENIED", status: 403 });

    expect(runtime.reason).not.toHaveBeenCalled();
    expect(runtime.search).not.toHaveBeenCalled();
    expect(runtime.run).not.toHaveBeenCalled();
  });
});
