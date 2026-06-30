import { auth } from "@clerk/nextjs/server";
import { Role, TenantStatus, OrganizationStatus, UserStatus } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { getAuthenticationPrismaClient } from "@/intelligence/authentication/prisma-client";

export type AuthorizationContextFailureReason =
  | "UNAUTHENTICATED"
  | "USER_NOT_FOUND"
  | "USER_INACTIVE"
  | "MEMBERSHIP_NOT_FOUND"
  | "MEMBERSHIP_INACTIVE"
  | "ORGANIZATION_NOT_FOUND"
  | "ORGANIZATION_INACTIVE"
  | "TENANT_NOT_FOUND"
  | "TENANT_INACTIVE";

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
    return unauthorized("UNAUTHENTICATED", null, false);
  }

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
    return unauthorized("USER_NOT_FOUND", clerkUserId);
  }

  if (user.status !== UserStatus.ACTIVE || user.archivedAt) {
    return unauthorized("USER_INACTIVE", clerkUserId);
  }

  const membership = user.memberships.find((candidateMembership) =>
    isResolvableMembership(candidateMembership),
  );

  if (!membership) {
    return unauthorized("MEMBERSHIP_NOT_FOUND", clerkUserId);
  }

  if (membership.archivedAt) {
    return unauthorized("MEMBERSHIP_INACTIVE", clerkUserId);
  }

  if (!membership.organization) {
    return unauthorized("ORGANIZATION_NOT_FOUND", clerkUserId);
  }

  if (
    membership.organization.status !== OrganizationStatus.ACTIVE ||
    membership.organization.archivedAt
  ) {
    return unauthorized("ORGANIZATION_INACTIVE", clerkUserId);
  }

  const tenant = membership.organization.tenant ?? membership.tenant;
  if (!tenant) {
    return unauthorized("TENANT_NOT_FOUND", clerkUserId);
  }

  if (tenant.status !== TenantStatus.ACTIVE || tenant.archivedAt) {
    return unauthorized("TENANT_INACTIVE", clerkUserId);
  }

  return {
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
