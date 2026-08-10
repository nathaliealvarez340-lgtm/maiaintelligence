import { describe, expect, it } from "vitest";

import type { AuthorizedContext, UnauthorizedContext } from "./authorization-context";
import { AuthorizationError } from "./authorization-errors";
import {
  memoryVersionScopedWhere,
  messageScopedWhere,
  requireAuthorizationContext,
  requireOrganizationAccess,
  requireTenantAccess,
} from "./authorization-enforcement";

const authorizedContext: AuthorizedContext = {
  userId: "user_1",
  clerkUserId: "clerk_1",
  tenantId: "tenant_1",
  organizationId: "organization_1",
  membershipId: "membership_1",
  role: "OWNER",
  permissions: ["chat:use"],
  isAuthenticated: true,
  isAuthorized: true,
};

const unauthorizedContext: UnauthorizedContext = {
  userId: null,
  clerkUserId: "clerk_2",
  tenantId: null,
  organizationId: null,
  membershipId: null,
  role: null,
  permissions: [],
  isAuthenticated: true,
  isAuthorized: false,
  reason: "MEMBERSHIP_NOT_FOUND",
};

describe("authorization enforcement", () => {
  it("allows authorized tenant access", async () => {
    await expect(requireTenantAccess("tenant_1", authorizedContext)).resolves.toEqual(
      authorizedContext,
    );
  });

  it("denies authenticated users without membership", async () => {
    await expect(requireAuthorizationContext(unauthorizedContext)).rejects.toMatchObject({
      code: "AUTHORIZATION_CONTEXT_REQUIRED",
      status: 403,
    });
  });

  it("denies cross-tenant access", async () => {
    await expect(requireTenantAccess("tenant_2", authorizedContext)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("denies forged organization access", async () => {
    await expect(
      requireOrganizationAccess("organization_2", authorizedContext),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_ACCESS_DENIED",
    });
  });

  it("scopes message access through the parent conversation tenant", () => {
    expect(messageScopedWhere("message_1", authorizedContext)).toEqual({
      id: "message_1",
      conversation: {
        tenantId: "tenant_1",
      },
    });
  });

  it("scopes memory version access through the parent memory tenant", () => {
    expect(memoryVersionScopedWhere("memory_version_1", authorizedContext)).toEqual({
      id: "memory_version_1",
      memory: {
        tenantId: "tenant_1",
      },
    });
  });
});
