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
  Prisma,
  PrismaClient,
  Tenant,
  User,
} from "@/generated/prisma/client";
import { getAuthenticationPrismaClient } from "@/intelligence/authentication/prisma-client";
import { rolePermissions } from "@/intelligence/authorization/role-permissions";
import { Roles } from "@/intelligence/contracts/enums";
import { emitIdentityEvent, IdentityEventNames } from "@/intelligence/observability/identity-events";
import { MaiaError } from "@/intelligence/shared/errors";
import { FirstUserBootstrapOutcomes } from "./bootstrap-outcome";
import { runSerializedFirstUserBootstrap } from "./bootstrap-transaction";

const DEFAULT_TENANT_NAME = "MAIA Intelligence";
const DEFAULT_TENANT_SLUG = "maia-intelligence";
const DEFAULT_ORGANIZATION_NAME = "MAIA Intelligence";
const INITIAL_OWNER_BOOTSTRAP_LOCK_KEY = 0x4d41494100000001n;

export interface FirstUserBootstrapInput {
  userId: string;
}

interface SuccessfulFirstUserBootstrapData {
  userId: string;
  tenantId: string;
  organizationId: string;
  membershipId: string;
  role: typeof Role.OWNER;
}

export type FirstUserBootstrapResult =
  | ({ outcome: typeof FirstUserBootstrapOutcomes.succeeded } &
      SuccessfulFirstUserBootstrapData)
  | { outcome: typeof FirstUserBootstrapOutcomes.notEligible };

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

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      return runSerializedFirstUserBootstrap({
        acquireSerialization: async () => {
          await acquireInitialOwnerBootstrapLock(tx);

          // PostgreSQL holds this lock until the surrounding transaction ends.
          return () => undefined;
        },
        resolveSubject: async () =>
          assertEligibleBootstrapUser(await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, status: true, archivedAt: true },
          })),
        resolveExistingOwner: async (user) => {
          const context = await findExistingOwnerContext(user, tx);
          return context ? toBootstrapData(context) : null;
        },
        hasEstablishedState: () => hasEstablishedBootstrapState(tx),
        onBootstrapStarted: (user) => {
          emitIdentityEvent({
            event: IdentityEventNames.bootstrapStarted,
            severity: "info",
            userId: user.id,
            operation: "first_user_bootstrap",
          });
        },
        createInitialOwner: async (user) =>
          toBootstrapData(await createInitialOwnerContext(user, tx)),
      });
    });

    if (transactionResult.outcome === FirstUserBootstrapOutcomes.notEligible) {
      return { outcome: FirstUserBootstrapOutcomes.notEligible };
    }

    const result: FirstUserBootstrapResult = {
      outcome: FirstUserBootstrapOutcomes.succeeded,
      ...transactionResult.value,
    };

    if (transactionResult.performed) {
      emitIdentityEvent({
        event: IdentityEventNames.bootstrapCompleted,
        severity: "info",
        userId: result.userId,
        tenantId: result.tenantId,
        organizationId: result.organizationId,
        membershipId: result.membershipId,
        operation: "first_user_bootstrap",
      });
    }

    return result;
  } catch (error) {
    emitIdentityEvent({
      event: IdentityEventNames.bootstrapFailed,
      severity: "error",
      userId,
      operation: "first_user_bootstrap",
      reason: error instanceof MaiaError ? error.code : "BOOTSTRAP_FAILED",
    });
    throw error;
  }
};

const acquireInitialOwnerBootstrapLock = async (
  tx: Prisma.TransactionClient,
) => {
  // Serializes first-owner eligibility and creation across application instances.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${INITIAL_OWNER_BOOTSTRAP_LOCK_KEY})`;
};

const findExistingOwnerContext = async (
  user: Pick<User, "id" | "status" | "archivedAt">,
  tx: Prisma.TransactionClient,
): Promise<BootstrapContext | null> => {
  const memberships = await tx.membership.findMany({
    where: {
      userId: user.id,
      role: Role.OWNER,
      archivedAt: null,
    },
    select: {
      id: true,
      role: true,
      tenant: {
        select: { id: true, status: true, archivedAt: true },
      },
      organization: {
        select: {
          id: true,
          tenantId: true,
          status: true,
          archivedAt: true,
        },
      },
    },
  });

  const membership = memberships.find(
    (candidate) =>
      candidate.organization.tenantId === candidate.tenant.id &&
      candidate.organization.status === OrganizationStatus.ACTIVE &&
      !candidate.organization.archivedAt &&
      candidate.tenant.status === TenantStatus.ACTIVE &&
      !candidate.tenant.archivedAt,
  );

  return membership
    ? {
        user,
        tenant: membership.tenant,
        organization: membership.organization,
        membership,
      }
    : null;
};

const hasEstablishedBootstrapState = async (tx: Prisma.TransactionClient) => {
  const [tenantCount, organizationCount, membershipCount] = await Promise.all([
    tx.tenant.count(),
    tx.organization.count(),
    tx.membership.count(),
  ]);

  return tenantCount > 0 || organizationCount > 0 || membershipCount > 0;
};

const createInitialOwnerContext = async (
  user: Pick<User, "id" | "status" | "archivedAt">,
  tx: Prisma.TransactionClient,
): Promise<BootstrapContext> => {
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

  return { user, tenant, organization, membership };
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

const toBootstrapData = ({
  user,
  tenant,
  organization,
  membership,
}: BootstrapContext): SuccessfulFirstUserBootstrapData => ({
  userId: user.id,
  tenantId: tenant.id,
  organizationId: organization.id,
  membershipId: membership.id,
  role: Role.OWNER,
});
