import { describe, expect, it } from "vitest";

import type { AuthorizedContext, UnauthorizedContext } from "./authorization-context";
import { AuthorizationError } from "./authorization-errors";
import {
  memoryVersionScopedWhere,
  messageScopedWhere,
  requireAuthorizationContext,
  requireOrganizationAccess,
  requirePermissionAccess,
  requireTenantAccess,
} from "./authorization-enforcement";
import {
  IdentityEventNames,
  setIdentityEventEmitterForTesting,
  type IdentityEvent,
} from "../observability/identity-events";

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

const unauthenticatedContext: UnauthorizedContext = {
  ...unauthorizedContext,
  clerkUserId: null,
  isAuthenticated: false,
  reason: "UNAUTHENTICATED",
};

const captureIdentityEvents = async (operation: () => void | Promise<void>) => {
  const emittedEvents: IdentityEvent[] = [];
  const restoreEmitter = setIdentityEventEmitterForTesting({
    emit(event) {
      emittedEvents.push(event);
    },
  });

  try {
    await operation();
  } finally {
    restoreEmitter();
  }

  return emittedEvents;
};

describe("authorization enforcement", () => {
  it("allows authorized tenant access", async () => {
    await expect(requireTenantAccess("tenant_1", authorizedContext)).resolves.toEqual(
      authorizedContext,
    );
  });

  it("does not emit duplicate success events from enforcement helpers", async () => {
    const emittedEvents = await captureIdentityEvents(async () => {
      await expect(requireTenantAccess("tenant_1", authorizedContext)).resolves.toEqual(
        authorizedContext,
      );
    });

    expect(emittedEvents).toEqual([]);
  });

  it("does not duplicate canonical context-resolution denial events", async () => {
    const emittedEvents = await captureIdentityEvents(async () => {
      await expect(requireAuthorizationContext(unauthorizedContext)).rejects.toMatchObject({
        code: "AUTHORIZATION_CONTEXT_REQUIRED",
        status: 403,
      });
    });

    expect(emittedEvents).toEqual([]);
  });

  it("preserves unauthenticated 401 behavior without a duplicate denial event", async () => {
    const emittedEvents = await captureIdentityEvents(async () => {
      await expect(requireAuthorizationContext(unauthenticatedContext)).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
        status: 401,
      });
    });

    expect(emittedEvents).toEqual([]);
  });

  it("emits a tenant enforcement denial", async () => {
    const emittedEvents = await captureIdentityEvents(async () => {
      await expect(requireTenantAccess("tenant_2", authorizedContext)).rejects.toMatchObject({
        code: "TENANT_ACCESS_DENIED",
        status: 403,
      });
    });

    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0]).toMatchObject({
      event: IdentityEventNames.authorizationDenied,
      severity: "warn",
      reason: "TENANT_ACCESS_DENIED",
      operation: "require_tenant_access",
      userId: authorizedContext.userId,
      tenantId: authorizedContext.tenantId,
    });
  });

  it("emits an organization enforcement denial", async () => {
    const emittedEvents = await captureIdentityEvents(async () => {
      await expect(
        requireOrganizationAccess("organization_2", authorizedContext),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_ACCESS_DENIED",
        status: 403,
      });
    });

    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0]).toMatchObject({
      event: IdentityEventNames.authorizationDenied,
      severity: "warn",
      reason: "ORGANIZATION_ACCESS_DENIED",
      operation: "require_organization_access",
      organizationId: authorizedContext.organizationId,
    });
  });

  it("emits a permission enforcement denial", async () => {
    const emittedEvents = await captureIdentityEvents(async () => {
      await expect(
        requirePermissionAccess("memory:write", authorizedContext),
      ).rejects.toMatchObject({
        code: "PERMISSION_DENIED",
        status: 403,
      });
    });

    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0]).toMatchObject({
      event: IdentityEventNames.authorizationDenied,
      severity: "warn",
      reason: "PERMISSION_DENIED",
      operation: "require_permission_access",
      membershipId: authorizedContext.membershipId,
    });
  });

  it("emits a resource-scope enforcement denial", async () => {
    const emittedEvents = await captureIdentityEvents(() => {
      let thrownError: unknown;

      try {
        messageScopedWhere(" ", authorizedContext);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(AuthorizationError);
      expect(thrownError).toMatchObject({
        code: "RESOURCE_ID_REQUIRED",
        status: 403,
      });
    });

    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0]).toMatchObject({
      event: IdentityEventNames.authorizationDenied,
      severity: "warn",
      reason: "RESOURCE_ID_REQUIRED",
      operation: "scope_resource_access",
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
