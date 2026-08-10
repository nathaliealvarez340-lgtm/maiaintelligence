import type { Prisma } from "@/generated/prisma/client";
import { emitIdentityEvent, IdentityEventNames } from "../observability/identity-events";

import {
  type AuthorizationContext,
  type AuthorizedContext,
} from "./authorization-context";
import { AuthorizationError } from "./authorization-errors";

type ResolvableAuthorizationContext = AuthorizationContext | Promise<AuthorizationContext>;

export const requireAuthorizationContext = async (
  context?: ResolvableAuthorizationContext,
): Promise<AuthorizedContext> => {
  const resolvedContext = context ? await context : await resolveAuthorizationContext();

  if (resolvedContext.isAuthorized) {
    return resolvedContext;
  }

  if (!resolvedContext.isAuthenticated) {
    throw new AuthorizationError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      { reason: resolvedContext.reason },
      401,
    );
  }

  throw new AuthorizationError(
    "AUTHORIZATION_CONTEXT_REQUIRED",
    "A valid MAIA authorization context is required.",
    { reason: resolvedContext.reason },
  );
};

const resolveAuthorizationContext = async () => {
  const authorizationContext = await import("./authorization-context");
  return authorizationContext.resolveAuthorizationContext();
};

export const requireTenantAccess = async (
  tenantId: string,
  context?: ResolvableAuthorizationContext,
) => {
  const authorizedContext = await requireAuthorizationContext(context);

  if (!tenantId || tenantId !== authorizedContext.tenantId) {
    emitAuthorizationDenied("TENANT_ACCESS_DENIED", "require_tenant_access", {
      userId: authorizedContext.userId,
      clerkUserId: authorizedContext.clerkUserId,
      tenantId: authorizedContext.tenantId,
      organizationId: authorizedContext.organizationId,
      membershipId: authorizedContext.membershipId,
    });
    throw new AuthorizationError(
      "TENANT_ACCESS_DENIED",
      "Tenant access is denied.",
    );
  }

  return authorizedContext;
};

export const requireOrganizationAccess = async (
  organizationId: string,
  context?: ResolvableAuthorizationContext,
) => {
  const authorizedContext = await requireAuthorizationContext(context);

  if (!organizationId || organizationId !== authorizedContext.organizationId) {
    emitAuthorizationDenied("ORGANIZATION_ACCESS_DENIED", "require_organization_access", {
      userId: authorizedContext.userId,
      clerkUserId: authorizedContext.clerkUserId,
      tenantId: authorizedContext.tenantId,
      organizationId: authorizedContext.organizationId,
      membershipId: authorizedContext.membershipId,
    });
    throw new AuthorizationError(
      "ORGANIZATION_ACCESS_DENIED",
      "Organization access is denied.",
    );
  }

  return authorizedContext;
};

export const requirePermissionAccess = async (
  permission: string,
  context?: ResolvableAuthorizationContext,
) => {
  const authorizedContext = await requireAuthorizationContext(context);

  if (!permission || !authorizedContext.permissions.includes(permission)) {
    emitAuthorizationDenied("PERMISSION_DENIED", "require_permission_access", {
      userId: authorizedContext.userId,
      clerkUserId: authorizedContext.clerkUserId,
      tenantId: authorizedContext.tenantId,
      organizationId: authorizedContext.organizationId,
      membershipId: authorizedContext.membershipId,
    });
    throw new AuthorizationError(
      "PERMISSION_DENIED",
      "User permission is not allowed.",
    );
  }

  return authorizedContext;
};

export const tenantScopedWhere = (context: AuthorizedContext) => ({
  tenantId: context.tenantId,
});

export const organizationScopedWhere = (context: AuthorizedContext) => ({
  tenantId: context.tenantId,
  organizationId: context.organizationId,
});

export const messageScopedWhere = (
  messageId: string,
  context: AuthorizedContext,
): Prisma.MessageWhereInput => ({
  id: requireResourceId(messageId),
  conversation: {
    tenantId: context.tenantId,
  },
});

export const memoryVersionScopedWhere = (
  memoryVersionId: string,
  context: AuthorizedContext,
): Prisma.MemoryVersionWhereInput => ({
  id: requireResourceId(memoryVersionId),
  memory: {
    tenantId: context.tenantId,
  },
});

const requireResourceId = (resourceId: string) => {
  const normalizedResourceId = resourceId.trim();
  if (!normalizedResourceId) {
    emitAuthorizationDenied("RESOURCE_ID_REQUIRED", "scope_resource_access");
    throw new AuthorizationError(
      "RESOURCE_ID_REQUIRED",
      "Resource ID is required.",
    );
  }
  return normalizedResourceId;
};

const emitAuthorizationDenied = (
  reason: string,
  operation: string,
  context?: {
    userId?: string;
    clerkUserId?: string | null;
    tenantId?: string;
    organizationId?: string;
    membershipId?: string;
  },
) => {
  emitIdentityEvent({
    event: IdentityEventNames.authorizationDenied,
    severity: "warn",
    reason,
    operation,
    userId: context?.userId,
    clerkUserId: context?.clerkUserId ?? undefined,
    tenantId: context?.tenantId,
    organizationId: context?.organizationId,
    membershipId: context?.membershipId,
  });
};
