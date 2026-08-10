import type { Prisma } from "@/generated/prisma/client";

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
    throw new AuthorizationError(
      "RESOURCE_ID_REQUIRED",
      "Resource ID is required.",
    );
  }
  return normalizedResourceId;
};
