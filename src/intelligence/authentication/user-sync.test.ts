import { describe, expect, it, vi } from "vitest";

import { UserStatus } from "../../generated/prisma/enums";
import type { User } from "../../generated/prisma/client";
import {
  syncClerkUserReadRepair,
  type ClerkUserLike,
} from "./user-sync";

vi.mock("@/generated/prisma/enums", async () =>
  import("../../generated/prisma/enums"),
);
vi.mock("@/intelligence/observability/identity-events", () => ({
  IdentityEventNames: {
    userSyncCreated: "identity.user_sync.created",
    userSyncUpdated: "identity.user_sync.updated",
    userSyncDeactivated: "identity.user_sync.deactivated",
    userSyncFailed: "identity.user_sync.failed",
  },
  emitIdentityEvent: vi.fn(),
}));
vi.mock("./prisma-client", () => ({
  getAuthenticationPrismaClient: vi.fn(),
}));

const trustedClerkUser: ClerkUserLike = {
  id: "clerk_1",
  primaryEmailAddress: { emailAddress: "owner@example.com" },
  firstName: "MAIA",
  lastName: "Owner",
};

describe("Clerk user read-repair synchronization", () => {
  it("creates a genuinely missing user from trusted Clerk identity", async () => {
    const createdUser = createUser(UserStatus.ACTIVE);
    const findUnique = vi.fn(async () => null);
    const create = vi.fn(async () => createdUser);

    const result = await syncClerkUserReadRepair(
      trustedClerkUser,
      asReadRepairClient(findUnique, create),
    );

    expect(result).toBe(createdUser);
    expect(create).toHaveBeenCalledWith({
      data: {
        clerkUserId: "clerk_1",
        email: "owner@example.com",
        name: "MAIA Owner",
        status: UserStatus.ACTIVE,
        archivedAt: null,
      },
    });
  });

  it("keeps repeated read-repair idempotent", async () => {
    let storedUser: User | null = null;
    const findUnique = vi.fn(async () => storedUser);
    const create = vi.fn(async () => {
      storedUser = createUser(UserStatus.ACTIVE);
      return storedUser;
    });
    const client = asReadRepairClient(findUnique, create);

    const firstResult = await syncClerkUserReadRepair(trustedClerkUser, client);
    const secondResult = await syncClerkUserReadRepair(trustedClerkUser, client);

    expect(firstResult).toBe(storedUser);
    expect(secondResult).toBe(storedUser);
    expect(create).toHaveBeenCalledOnce();
  });

  it("resolves an existing active user that wins a concurrent create race", async () => {
    const activeUser = createUser(UserStatus.ACTIVE);
    const findUnique = vi
      .fn<() => Promise<User | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(activeUser);
    const create = vi.fn(async () => {
      throw { code: "P2002" };
    });

    const result = await syncClerkUserReadRepair(
      trustedClerkUser,
      asReadRepairClient(findUnique, create),
    );

    expect(result).toBe(activeUser);
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledOnce();
  });

  it("does not reactivate an archived user that appears during creation", async () => {
    const archivedAt = new Date("2026-08-01T00:00:00.000Z");
    const archivedUser = createUser(UserStatus.ARCHIVED, archivedAt);
    const findUnique = vi
      .fn<() => Promise<User | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(archivedUser);
    const create = vi.fn(async () => {
      throw { code: "P2002" };
    });

    const result = await syncClerkUserReadRepair(
      trustedClerkUser,
      asReadRepairClient(findUnique, create),
    );

    expect(result.status).toBe(UserStatus.ARCHIVED);
    expect(result.archivedAt).toBe(archivedAt);
    expect(create).toHaveBeenCalledOnce();
  });

  it("does not reactivate a suspended user that appears during creation", async () => {
    const suspendedUser = createUser(UserStatus.SUSPENDED);
    const findUnique = vi
      .fn<() => Promise<User | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(suspendedUser);
    const create = vi.fn(async () => {
      throw { code: "P2002" };
    });

    const result = await syncClerkUserReadRepair(
      trustedClerkUser,
      asReadRepairClient(findUnique, create),
    );

    expect(result.status).toBe(UserStatus.SUSPENDED);
    expect(result.archivedAt).toBeNull();
    expect(create).toHaveBeenCalledOnce();
  });
});

const createUser = (
  status: UserStatus,
  archivedAt: Date | null = null,
): User => ({
  id: "user_1",
  clerkUserId: "clerk_1",
  email: "owner@example.com",
  name: "MAIA Owner",
  status,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  archivedAt,
});

type ReadRepairClient = NonNullable<
  Parameters<typeof syncClerkUserReadRepair>[1]
>;

const asReadRepairClient = (
  findUnique: unknown,
  create: unknown,
): ReadRepairClient =>
  ({ findUnique, create }) as ReadRepairClient;
