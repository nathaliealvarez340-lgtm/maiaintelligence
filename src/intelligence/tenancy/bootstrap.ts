import {
  OrganizationStatus,
  OrganizationType,
  Role,
  TenantPlan,
  TenantStatus,
  UserStatus,
} from "@/generated/prisma/enums";
import type {
  Membership,
  Organization,
  PrismaClient,
  Tenant,
  User,
} from "@/generated/prisma/client";
import { getAuthenticationPrismaClient } from "@/intelligence/authentication/prisma-client";
import { rolePermissions } from "@/intelligence/authorization/role-permissions";
import { Roles } from "@/intelligence/contracts/enums";
import { MaiaError } from "@/intelligence/shared/errors";

const DEFAULT_TENANT_NAME = "MAIA Intelligence";
const DEFAULT_TENANT_SLUG = "maia-intelligence";
const DEFAULT_ORGANIZATION_NAME = "MAIA Intelligence";

export interface FirstUserBootstrapInput {
  userId: string;
}

export interface FirstUserBootstrapResult {
  userId: string;
  tenantId: string;
  organizationId: string;
  membershipId: string;
  role: typeof Role.OWNER;
}

type BootstrapContext = {
  user: Pick<User, "id" | "status" | "archivedAt">;
  tenant: Pick<Tenant, "id">;
  organization: Pick<Organization, "id">;
  membership: Pick<Membership, "id" | "role">;
};

export const bootstrapFirstUser = async (
  input: FirstUserBootstrapInput,
  prisma: PrismaClient = getAuthenticationPrismaClient(),
): Promise<FirstUserBootstrapResult> => {
  const userId = normalizeUserId(input.userId);

  return prisma.$transaction(async (tx) => {
    const user = assertEligibleBootstrapUser(await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, archivedAt: true },
    }));

    const existingOwnerMembership = await tx.membership.findFirst({
      where: {
        userId: user.id,
        role: Role.OWNER,
        archivedAt: null,
      },
      select: {
        id: true,
        role: true,
        tenant: { select: { id: true } },
        organization: { select: { id: true } },
      },
    });

    if (existingOwnerMembership) {
      return toBootstrapResult({
        user,
        tenant: existingOwnerMembership.tenant,
        organization: existingOwnerMembership.organization,
        membership: existingOwnerMembership,
      });
    }

    const tenant = await tx.tenant.upsert({
      where: { slug: DEFAULT_TENANT_SLUG },
      create: {
        name: DEFAULT_TENANT_NAME,
        slug: DEFAULT_TENANT_SLUG,
        status: TenantStatus.ACTIVE,
        plan: TenantPlan.STARTER,
      },
      update: {
        status: TenantStatus.ACTIVE,
        archivedAt: null,
      },
      select: { id: true },
    });

    const organization = await tx.organization.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: DEFAULT_ORGANIZATION_NAME,
        },
      },
      create: {
        tenantId: tenant.id,
        name: DEFAULT_ORGANIZATION_NAME,
        type: OrganizationType.INTERNAL,
        status: OrganizationStatus.ACTIVE,
      },
      update: {
        type: OrganizationType.INTERNAL,
        status: OrganizationStatus.ACTIVE,
        archivedAt: null,
      },
      select: { id: true },
    });

    const existingTenantOwnerMembership = await tx.membership.findFirst({
      where: {
        tenantId: tenant.id,
        organizationId: organization.id,
        role: Role.OWNER,
        archivedAt: null,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (existingTenantOwnerMembership?.userId !== undefined) {
      throw new MaiaError(
        "BOOTSTRAP_OWNER_ALREADY_EXISTS",
        "An active owner membership already exists for this tenant.",
        409,
      );
    }

    // The compound unique key makes repeat bootstrap calls for the same user idempotent.
    const membership = await tx.membership.upsert({
      where: {
        tenantId_organizationId_userId: {
          tenantId: tenant.id,
          organizationId: organization.id,
          userId: user.id,
        },
      },
      create: {
        tenantId: tenant.id,
        organizationId: organization.id,
        userId: user.id,
        role: Role.OWNER,
        permissions: rolePermissions[Roles.owner],
      },
      update: {
        role: Role.OWNER,
        permissions: rolePermissions[Roles.owner],
        archivedAt: null,
      },
      select: { id: true, role: true },
    });

    return toBootstrapResult({ user, tenant, organization, membership });
  });
};

const normalizeUserId = (userId: string) => {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new MaiaError("BOOTSTRAP_USER_ID_REQUIRED", "User ID is required.", 400);
  }
  return normalizedUserId;
};

const assertEligibleBootstrapUser = (
  user: Pick<User, "id" | "status" | "archivedAt"> | null,
): Pick<User, "id" | "status" | "archivedAt"> => {
  if (!user) {
    throw new MaiaError("BOOTSTRAP_USER_NOT_FOUND", "User was not found.", 404);
  }

  if (user.status !== UserStatus.ACTIVE || user.archivedAt) {
    throw new MaiaError(
      "BOOTSTRAP_USER_NOT_ELIGIBLE",
      "User is not eligible for bootstrap.",
      409,
    );
  }

  return user;
};

const toBootstrapResult = ({
  user,
  tenant,
  organization,
  membership,
}: BootstrapContext): FirstUserBootstrapResult => ({
  userId: user.id,
  tenantId: tenant.id,
  organizationId: organization.id,
  membershipId: membership.id,
  role: Role.OWNER,
});
