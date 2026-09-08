import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { AuthorizedContext } from "../authorization/authorization-context";
import type { BusinessContextHints, IntelligenceRequest } from "../contracts/types";
import type { MemoryRecord } from "../memory/memory-repository";
import { MockMemoryRepository } from "../memory/mock-memory-repository";
import { BusinessContextEngine, type ContextEngine } from "./context-engine";

vi.mock("@/intelligence/shared/errors", async () => import("../shared/errors"));

const authorization: AuthorizedContext = {
  userId: "user_authorized",
  clerkUserId: "clerk_authorized",
  tenantId: "tenant_authorized",
  organizationId: "organization_authorized",
  membershipId: "membership_authorized",
  role: "MEMBER",
  permissions: ["memory:read"],
  isAuthenticated: true,
  isAuthorized: true,
};

const request: IntelligenceRequest = {
  requestId: "request_1",
  productContext: "maia",
  message: "Analyze the business",
};

const memoryRecord = (tenantId: string, content: unknown): MemoryRecord => ({
  id: `memory_${tenantId}`,
  tenantId,
  productId: "maia",
  type: "business-context",
  content,
  tags: [],
  createdAt: "2026-09-06T00:00:00.000Z",
  updatedAt: "2026-09-06T00:00:00.000Z",
});

describe("authorized business context retrieval", () => {
  it("requires authorization separately and excludes scope from typed hints", () => {
    expectTypeOf<Parameters<ContextEngine["build"]>>().toEqualTypeOf<[
      IntelligenceRequest,
      AuthorizedContext,
    ]>();
    expectTypeOf<Extract<
      keyof BusinessContextHints,
      "tenantId" | "productContext" | "productId" | "userId" | "organizationId" | "membershipId" | "role" | "permissions"
    >>().toEqualTypeOf<never>();
  });

  it("retrieves only the authorized tenant's memory", async () => {
    const memory = new MockMemoryRepository();
    await memory.save(memoryRecord("tenant_authorized", { company: { name: "Authorized company" } }));
    await memory.save(memoryRecord("tenant_attacker_target", { company: { name: "Other tenant company" } }));
    const search = vi.spyOn(memory, "search");
    const engine = new BusinessContextEngine(memory);
    const payload = { ...request, tenantId: "tenant_attacker_target" };

    const context = await engine.build(payload, authorization);

    expect(search).toHaveBeenCalledExactlyOnceWith({
      tenantId: authorization.tenantId,
      productId: "maia",
      type: "business-context",
    });
    expect(context.tenantId).toBe(authorization.tenantId);
    expect(context.company.name).toBe("Authorized company");
  });

  it("allows business hints without allowing stored or supplied scope overrides", async () => {
    const memory = new MockMemoryRepository();
    await memory.save(memoryRecord(authorization.tenantId, {
      tenantId: "tenant_from_memory",
      productContext: "orbit",
      productId: "product_from_memory",
      clerkUserId: "clerk_from_memory",
      organizationId: "organization_from_memory",
      membershipId: "membership_from_memory",
      role: "OWNER",
      permissions: ["audit:read"],
      company: { name: "Remembered company" },
      priorities: ["Remembered priority"],
    }));
    const engine = new BusinessContextEngine(memory);
    const payload = {
      ...request,
      contextHints: {
        tenantId: "tenant_attacker_target",
        productContext: "off",
        productId: "product_attacker_target",
        userId: "user_attacker_target",
        role: "ADMIN",
        permissions: ["memory:write"],
        company: { name: "Requested company" },
        strategicGoals: ["Requested goal"],
      },
    };

    expect(await engine.build(payload, authorization)).toEqual({
      tenantId: authorization.tenantId,
      productContext: request.productContext,
      productId: request.productContext,
      company: { name: "Requested company" },
      strategicGoals: ["Requested goal"],
      kpis: [],
      projects: [],
      clients: [],
      risks: [],
      priorities: ["Remembered priority"],
      decisions: [],
      operationalStatus: [],
    });
  });

  it("rejects missing authorization before searching memory", async () => {
    const memory = new MockMemoryRepository();
    const search = vi.spyOn(memory, "search");
    const engine = new BusinessContextEngine(memory);

    // @ts-expect-error Direct context retrieval also requires canonical authorization.
    const build = engine.build(request);

    await expect(build).rejects.toMatchObject({ code: "AUTHORIZATION_CONTEXT_REQUIRED", status: 403 });
    expect(search).not.toHaveBeenCalled();
  });

  it("does not grant memory permission based on the user's role", async () => {
    const memory = new MockMemoryRepository();
    const search = vi.spyOn(memory, "search");
    const engine = new BusinessContextEngine(memory);

    await expect(engine.build(request, {
      ...authorization,
      role: "OWNER",
      permissions: ["chat:use"],
    })).rejects.toMatchObject({ code: "PERMISSION_DENIED", status: 403 });
    expect(search).not.toHaveBeenCalled();
  });

  it("rejects an empty tenant scope before searching memory", async () => {
    const memory = new MockMemoryRepository();
    const search = vi.spyOn(memory, "search");
    const engine = new BusinessContextEngine(memory);

    await expect(engine.build(request, { ...authorization, tenantId: "" }))
      .rejects.toMatchObject({ code: "AUTHORIZATION_CONTEXT_REQUIRED", status: 403 });
    expect(search).not.toHaveBeenCalled();
  });

  it("preserves rejection of unknown product contexts", async () => {
    const memory = new MockMemoryRepository();
    const search = vi.spyOn(memory, "search");
    const engine = new BusinessContextEngine(memory);

    // @ts-expect-error An untyped caller can still supply an unsupported product context.
    const build = engine.build({ ...request, productContext: "unknown" }, authorization);

    await expect(build).rejects.toMatchObject({ code: "UNKNOWN_PRODUCT_CONTEXT", status: 400 });
    expect(search).not.toHaveBeenCalled();
  });
});
