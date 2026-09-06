import { UserStatus } from "@/generated/prisma/enums";
import type { PrismaClient, User } from "@/generated/prisma/client";

import type { AuthenticatedUser } from "./auth-service";
import { getAuthenticationPrismaClient } from "./prisma-client";
import { emitIdentityEvent, IdentityEventNames } from "@/intelligence/observability/identity-events";

export interface ClerkUserLike {
  id: string;
  primaryEmailAddress?: { emailAddress?: string } | null;
  primary_email_address_id?: string | null;
  email_addresses?: Array<{
    id?: string | null;
    email_address?: string | null;
  }> | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}

export const mapClerkUserToInternalUser = (user: ClerkUserLike): AuthenticatedUser => ({
  id: user.id,
  clerkUserId: user.id,
  email: user.primaryEmailAddress?.emailAddress,
});

type UserClient = Pick<
  PrismaClient["user"],
  "findUnique" | "create" | "update" | "upsert"
>;
type UserReadRepairClient = Pick<UserClient, "findUnique" | "create">;

export class ClerkUserSyncError extends Error {
  constructor(
    message: string,
    readonly statusCode = 422,
  ) {
    super(message);
    this.name = "ClerkUserSyncError";
  }
}

export const syncClerkUserCreated = async (
  user: ClerkUserLike,
  prisma: UserClient = getAuthenticationPrismaClient().user,
): Promise<User> => {
  try {
    const syncedUser = await upsertClerkUser(user, prisma);
    emitIdentityEvent({
      event: IdentityEventNames.userSyncCreated,
      severity: "info",
      userId: syncedUser.id,
      clerkUserId: syncedUser.clerkUserId,
      operation: "user.created",
    });
    return syncedUser;
  } catch (error) {
    emitUserSyncFailure(user.id, "user.created");
    throw error;
  }
};

export const syncClerkUserReadRepair = async (
  user: ClerkUserLike,
  prisma: UserReadRepairClient = getAuthenticationPrismaClient().user,
): Promise<User> => {
  try {
    const identity = getClerkUserPersistenceData(user);
    const existingUser = await prisma.findUnique({
      where: { clerkUserId: identity.clerkUserId },
    });
    if (existingUser) {
      return existingUser;
    }

    try {
      const createdUser = await prisma.create({
        data: {
          ...identity,
          status: UserStatus.ACTIVE,
          archivedAt: null,
        },
      });

      emitIdentityEvent({
        event: IdentityEventNames.userSyncCreated,
        severity: "info",
        userId: createdUser.id,
        clerkUserId: createdUser.clerkUserId,
        operation: "authorization.read_repair",
      });
      return createdUser;
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }

      const concurrentlyCreatedUser = await prisma.findUnique({
        where: { clerkUserId: identity.clerkUserId },
      });
      if (!concurrentlyCreatedUser) {
        throw error;
      }

      return concurrentlyCreatedUser;
    }
  } catch (error) {
    emitUserSyncFailure(user.id, "authorization.read_repair");
    throw error;
  }
};

export const syncClerkUserUpdated = async (
  user: ClerkUserLike,
  prisma: UserClient = getAuthenticationPrismaClient().user,
): Promise<User> => {
  try {
    const syncedUser = await upsertClerkUser(user, prisma);
    emitIdentityEvent({
      event: IdentityEventNames.userSyncUpdated,
      severity: "info",
      userId: syncedUser.id,
      clerkUserId: syncedUser.clerkUserId,
      operation: "user.updated",
    });
    return syncedUser;
  } catch (error) {
    emitUserSyncFailure(user.id, "user.updated");
    throw error;
  }
};

export const deactivateClerkUserDeleted = async (
  user: { id?: string | null },
  prisma: UserClient = getAuthenticationPrismaClient().user,
): Promise<User | null> => {
  try {
    const clerkUserId = normalizeRequiredString(user.id, "Clerk user ID is required.");
    const existingUser = await prisma.findUnique({
      where: { clerkUserId },
    });

    if (!existingUser) {
      return null;
    }

    if (existingUser.status === UserStatus.ARCHIVED && existingUser.archivedAt) {
      emitIdentityEvent({
        event: IdentityEventNames.userSyncDeactivated,
        severity: "info",
        userId: existingUser.id,
        clerkUserId: existingUser.clerkUserId,
        operation: "user.deleted",
      });
      return existingUser;
    }

    const deactivatedUser = await prisma.update({
      where: { clerkUserId },
      data: {
        status: UserStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    emitIdentityEvent({
      event: IdentityEventNames.userSyncDeactivated,
      severity: "info",
      userId: deactivatedUser.id,
      clerkUserId: deactivatedUser.clerkUserId,
      operation: "user.deleted",
    });

    return deactivatedUser;
  } catch (error) {
    emitUserSyncFailure(user.id, "user.deleted");
    throw error;
  }
};

const upsertClerkUser = async (
  user: ClerkUserLike,
  prisma: UserClient,
): Promise<User> => {
  const identity = getClerkUserPersistenceData(user);

  return prisma.upsert({
    where: { clerkUserId: identity.clerkUserId },
    create: {
      ...identity,
      status: UserStatus.ACTIVE,
      archivedAt: null,
    },
    update: {
      email: identity.email,
      name: identity.name,
      status: UserStatus.ACTIVE,
      archivedAt: null,
    },
  });
};

const getClerkUserPersistenceData = (user: ClerkUserLike) => ({
  clerkUserId: normalizeRequiredString(user.id, "Clerk user ID is required."),
  email: normalizeRequiredString(
    getPrimaryEmailAddress(user),
    "Primary email is required to synchronize a MAIA user.",
  ),
  name: getDisplayName(user),
});

const isUniqueConstraintViolation = (
  error: unknown,
): error is { code: "P2002" } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

const getPrimaryEmailAddress = (user: ClerkUserLike) => {
  const sdkEmail = user.primaryEmailAddress?.emailAddress;
  if (sdkEmail) {
    return sdkEmail;
  }

  const primaryEmailAddressId = user.primary_email_address_id;
  return user.email_addresses?.find(
    (emailAddress) => emailAddress.id === primaryEmailAddressId,
  )?.email_address;
};

const getDisplayName = (user: ClerkUserLike) => {
  const explicitName = normalizeOptionalString(user.fullName);
  if (explicitName) {
    return explicitName;
  }

  const firstName = normalizeOptionalString(user.firstName ?? user.first_name);
  const lastName = normalizeOptionalString(user.lastName ?? user.last_name);
  const name = [firstName, lastName].filter(Boolean).join(" ");

  return normalizeOptionalString(name) ?? normalizeOptionalString(user.username);
};

const normalizeRequiredString = (value: string | null | undefined, message: string) => {
  const normalizedValue = normalizeOptionalString(value);
  if (!normalizedValue) {
    throw new ClerkUserSyncError(message);
  }
  return normalizedValue;
};

const normalizeOptionalString = (value: string | null | undefined) => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
};

const emitUserSyncFailure = (clerkUserId: string | null | undefined, operation: string) => {
  emitIdentityEvent({
    event: IdentityEventNames.userSyncFailed,
    severity: "error",
    clerkUserId: normalizeOptionalString(clerkUserId),
    operation,
  });
};
