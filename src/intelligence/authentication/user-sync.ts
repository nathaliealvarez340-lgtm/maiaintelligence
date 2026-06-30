import { UserStatus } from "@/generated/prisma/enums";
import type { PrismaClient, User } from "@/generated/prisma/client";

import type { AuthenticatedUser } from "./auth-service";
import { getAuthenticationPrismaClient } from "./prisma-client";

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

type UserClient = Pick<PrismaClient["user"], "findUnique" | "update" | "upsert">;

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
): Promise<User> => upsertClerkUser(user, prisma);

export const syncClerkUserUpdated = async (
  user: ClerkUserLike,
  prisma: UserClient = getAuthenticationPrismaClient().user,
): Promise<User> => upsertClerkUser(user, prisma);

export const deactivateClerkUserDeleted = async (
  user: { id?: string | null },
  prisma: UserClient = getAuthenticationPrismaClient().user,
): Promise<User | null> => {
  const clerkUserId = normalizeRequiredString(user.id, "Clerk user ID is required.");
  const existingUser = await prisma.findUnique({
    where: { clerkUserId },
  });

  if (!existingUser) {
    return null;
  }

  if (existingUser.status === UserStatus.ARCHIVED && existingUser.archivedAt) {
    return existingUser;
  }

  return prisma.update({
    where: { clerkUserId },
    data: {
      status: UserStatus.ARCHIVED,
      archivedAt: new Date(),
    },
  });
};

const upsertClerkUser = async (
  user: ClerkUserLike,
  prisma: UserClient,
): Promise<User> => {
  const clerkUserId = normalizeRequiredString(user.id, "Clerk user ID is required.");
  const email = normalizeRequiredString(
    getPrimaryEmailAddress(user),
    "Primary email is required to synchronize a MAIA user.",
  );
  const name = getDisplayName(user);

  return prisma.upsert({
    where: { clerkUserId },
    create: {
      clerkUserId,
      email,
      name,
      status: UserStatus.ACTIVE,
      archivedAt: null,
    },
    update: {
      email,
      name,
      status: UserStatus.ACTIVE,
      archivedAt: null,
    },
  });
};

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
