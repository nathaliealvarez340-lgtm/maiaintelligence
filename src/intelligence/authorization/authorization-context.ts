import { auth, currentUser } from "@clerk/nextjs/server";
import { Role, TenantStatus, OrganizationStatus, UserStatus } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { getAuthenticationPrismaClient } from "@/intelligence/authentication/prisma-client";
import { syncClerkUserReadRepair } from "@/intelligence/authentication/user-sync";
import { emitIdentityEvent, IdentityEventNames } from "@/intelligence/observability/identity-events";
import { bootstrapFirstUser } from "@/intelligence/tenancy/bootstrap";
import {
  repairAuthenticatedUser,
  runAuthenticatedFirstAccessFlow,
  type FirstAccessFailureReason,
  type InternalAuthorizationResolution,
} from "./first-access-flow";

export type AuthorizationContextFailureReason =
  | "UNAUTHENTICATED"
  | "USER_NOT_FOUND"
  | "USER_INACTIVE"
  | "MEMBERSHIP_NOT_FOUND"
  | "MEMBERSHIP_INACTIVE"
  | "ORGANIZATION_NOT_FOUND"
  | "ORGANIZATION_INACTIVE"
  | "TENANT_NOT_FOUND"
  | "TENANT_INACTIVE"
  | FirstAccessFailureReason;

export interface AuthorizedContext {
  userId: string;
  clerkUserId: string;
  tenantId: string;
  organizationId: string;
  membershipId: string;
  role: Role;
  permissions: string[];
  isAuthenticated: true;
  isAuthorized: true;
}

export interface UnauthorizedContext {
  userId: null;
  clerkUserId: string | null;
  tenantId: null;
  organizationId: null;
  membershipId: null;
  role: null;
  permissions: [];
  isAuthenticated: boolean;
  isAuthorized: false;
  reason: AuthorizationContextFailureReason;
}

export type AuthorizationContext = AuthorizedContext | UnauthorizedContext;

export const resolveAuthorizationContext = async (
  prisma: PrismaClient = getAuthenticationPrismaClient(),
): Promise<AuthorizationContext> => {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return finalizeAuthorizationResolution({
      context: unauthorized("UNAUTHENTICATED", null, false),
      internalUserId: null,
    });
  }

  const resolution = await runAuthenticatedFirstAccessFlow<AuthorizationContext>({
    resolveInternalContext: () =>
      resolveInternalAuthorizationContext(clerkUserId, prisma),
    repairUser: () =>
      repairAuthenticatedUser(clerkUserId, currentUser, (trustedUser) =>
        syncClerkUserReadRepair(trustedUser, prisma.user),
      ),
    bootstrapUser: async (internalUserId) => {
      const result = await bootstrapFirstUser({ userId: internalUserId }, prisma);
      return result.outcome;
    },
    createFailureResolution: (reason, internalUserId) => ({
      context: unauthorized(reason, clerkUserId),
      internalUserId,
    }),
  });

  return finalizeAuthorizationResolution(resolution);
};

const resolveInternalAuthorizationContext = async (
  clerkUserId: string,
  prisma: PrismaClient,
): Promise<InternalAuthorizationResolution<AuthorizationContext>> => {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: {
      id: true,
      clerkUserId: true,
      status: true,
      archivedAt: true,
      memberships: {
        where: {
          archivedAt: null,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          tenantId: true,
          organizationId: true,
          role: true,
          permissions: true,
          archivedAt: true,
          organization: {
            select: {
              id: true,
              tenantId: true,
              status: true,
              archivedAt: true,
              tenant: {
                select: {
                  id: true,
                  status: true,
                  archivedAt: true,
                },
              },
            },
          },
          tenant: {
            select: {
              id: true,
              status: true,
              archivedAt: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return internalResolution(
      unauthorized("USER_NOT_FOUND", clerkUserId),
      null,
    );
  }

  if (user.status !== UserStatus.ACTIVE || user.archivedAt) {
    return internalResolution(
      unauthorized("USER_INACTIVE", clerkUserId),
      user.id,
    );
  }

  const membership = user.memberships.find((candidateMembership) =>
    isResolvableMembership(candidateMembership),
  );

  if (!membership) {
    return internalResolution(
      unauthorized("MEMBERSHIP_NOT_FOUND", clerkUserId),
      user.id,
    );
  }

  if (membership.archivedAt) {
    return internalResolution(
      unauthorized("MEMBERSHIP_INACTIVE", clerkUserId),
      user.id,
    );
  }

  if (!membership.organization) {
    return internalResolution(
      unauthorized("ORGANIZATION_NOT_FOUND", clerkUserId),
      user.id,
    );
  }

  if (
    membership.organization.status !== OrganizationStatus.ACTIVE ||
    membership.organization.archivedAt
  ) {
    return internalResolution(
      unauthorized("ORGANIZATION_INACTIVE", clerkUserId),
      user.id,
    );
  }

  const tenant = membership.organization.tenant ?? membership.tenant;
  if (!tenant) {
    return internalResolution(
      unauthorized("TENANT_NOT_FOUND", clerkUserId),
      user.id,
    );
  }

  if (tenant.status !== TenantStatus.ACTIVE || tenant.archivedAt) {
    return internalResolution(
      unauthorized("TENANT_INACTIVE", clerkUserId),
      user.id,
    );
  }

  const authorizedContext: AuthorizedContext = {
    userId: user.id,
    clerkUserId: user.clerkUserId,
    tenantId: tenant.id,
    organizationId: membership.organization.id,
    membershipId: membership.id,
    role: membership.role,
    permissions: toPermissionList(membership.permissions),
    isAuthenticated: true,
    isAuthorized: true,
  };

  return internalResolution(authorizedContext, user.id);
};

const unauthorized = (
  reason: AuthorizationContextFailureReason,
  clerkUserId: string | null,
  isAuthenticated = true,
): UnauthorizedContext => ({
  userId: null,
  clerkUserId,
  tenantId: null,
  organizationId: null,
  membershipId: null,
  role: null,
  permissions: [],
  isAuthenticated,
  isAuthorized: false,
  reason,
});

const internalResolution = (
  context: AuthorizationContext,
  internalUserId: string | null,
): InternalAuthorizationResolution<AuthorizationContext> => ({
  context,
  internalUserId,
});

const finalizeAuthorizationResolution = (
  resolution: InternalAuthorizationResolution<AuthorizationContext>,
): AuthorizationContext => {
  if (resolution.context.isAuthorized) {
    emitIdentityEvent({
      event: IdentityEventNames.authorizationResolved,
      severity: "info",
      userId: resolution.context.userId,
      clerkUserId: resolution.context.clerkUserId,
      tenantId: resolution.context.tenantId,
      organizationId: resolution.context.organizationId,
      membershipId: resolution.context.membershipId,
      operation: "resolve_authorization_context",
    });
  } else {
    emitIdentityEvent({
      event: IdentityEventNames.authorizationDenied,
      severity: "warn",
      userId: resolution.internalUserId ?? undefined,
      clerkUserId: resolution.context.clerkUserId ?? undefined,
      reason: resolution.context.reason,
      operation: "resolve_authorization_context",
    });
  }

  return resolution.context;
};

const isResolvableMembership = (membership: {
  tenantId: string;
  archivedAt: Date | null;
  organization: {
    tenantId: string;
    status: OrganizationStatus;
    archivedAt: Date | null;
    tenant: {
      status: TenantStatus;
      archivedAt: Date | null;
    };
  };
}) =>
  !membership.archivedAt &&
  membership.organization.tenantId === membership.tenantId &&
  membership.organization.status === OrganizationStatus.ACTIVE &&
  !membership.organization.archivedAt &&
  membership.organization.tenant.status === TenantStatus.ACTIVE &&
  !membership.organization.tenant.archivedAt;

const toPermissionList = (permissions: unknown) => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions.filter((permission): permission is string => typeof permission === "string");
};
