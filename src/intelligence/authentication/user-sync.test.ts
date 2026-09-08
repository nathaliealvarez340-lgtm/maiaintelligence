import { describe, expect, it, vi } from "vitest";

import { UserStatus } from "../../generated/prisma/enums";
import type { User } from "../../generated/prisma/client";
import {
  deactivateClerkUserDeleted,
  syncClerkUserCreated,
  syncClerkUserReadRepair,
  syncClerkUserUpdated,
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

const webhookUser: ClerkUserLike = {
  id: "clerk_1",
  primary_email_address_id: "email_1",
  email_addresses: [{ id: "email_1", email_address: "updated@example.com" }],
  first_name: "Updated",
  last_name: "Owner",
};

describe.each([
  { event: "user.created", synchronize: syncClerkUserCreated },
  { event: "user.updated", synchronize: syncClerkUserUpdated },
])("Clerk $event synchronization", ({ synchronize }) => {
  it("creates a genuinely missing ACTIVE user", async () => {
    const { client, getStoredUser } = createStatefulUserClient();

    const result = await synchronize(webhookUser, client);

    expect(getStoredUser()).toEqual(result);
    expect(result).toMatchObject({
      clerkUserId: "clerk_1",
      email: "updated@example.com",
      name: "Updated Owner",
      status: UserStatus.ACTIVE,
      archivedAt: null,
    });
  });

  it("idempotently synchronizes an ACTIVE user's profile", async () => {
    const existingUser = createUser(UserStatus.ACTIVE);
    const { client, getStoredUser } = createStatefulUserClient(existingUser);

    const firstResult = await synchronize(webhookUser, client);
    const secondResult = await synchronize(webhookUser, client);

    expect(firstResult).toEqual({
      ...existingUser,
      email: "updated@example.com",
      name: "Updated Owner",
    });
    expect(secondResult).toEqual(firstResult);
    expect(getStoredUser()).toEqual(firstResult);
  });

  it("preserves ARCHIVED status and the original archivedAt during profile sync", async () => {
    const archivedAt = new Date("2026-08-01T00:00:00.000Z");
    const existingUser = createUser(UserStatus.ARCHIVED, archivedAt);
    const { client, getStoredUser } = createStatefulUserClient(existingUser);

    const result = await synchronize(webhookUser, client);

    expect(result).toEqual({
      ...existingUser,
      email: "updated@example.com",
      name: "Updated Owner",
    });
    expect(getStoredUser()).toEqual(result);
  });

  it.each([null, new Date("2026-08-01T00:00:00.000Z")])(
    "preserves SUSPENDED status and archivedAt=%s during profile sync",
    async (archivedAt) => {
      const existingUser = createUser(UserStatus.SUSPENDED, archivedAt);
      const { client, getStoredUser } = createStatefulUserClient(existingUser);

      const result = await synchronize(webhookUser, client);

      expect(result).toEqual({
        ...existingUser,
        email: "updated@example.com",
        name: "Updated Owner",
      });
      expect(getStoredUser()).toEqual(result);
    },
  );

  it("does not resurrect a user when a delayed event follows user.deleted", async () => {
    const existingUser = createUser(UserStatus.ACTIVE);
    const { client, getStoredUser } = createStatefulUserClient(existingUser);

    const deletedUser = await deactivateClerkUserDeleted({ id: "clerk_1" }, client);
    expect(deletedUser).toMatchObject({
      id: existingUser.id,
      status: UserStatus.ARCHIVED,
      archivedAt: expect.any(Date),
    });

    const result = await synchronize(webhookUser, client);

    expect(result).toEqual({
      ...deletedUser,
      email: "updated@example.com",
      name: "Updated Owner",
    });
    expect(getStoredUser()).toEqual(result);
  });
});

describe("Clerk user.deleted synchronization", () => {
  it("archives without deleting and preserves the first archivedAt on repeated deletion", async () => {
    const existingUser = createUser(UserStatus.ACTIVE);
    const { client, getStoredUser, update } = createStatefulUserClient(existingUser);

    const firstResult = await deactivateClerkUserDeleted({ id: "clerk_1" }, client);
    const secondResult = await deactivateClerkUserDeleted({ id: "clerk_1" }, client);

    expect(firstResult).toEqual({
      ...existingUser,
      status: UserStatus.ARCHIVED,
      archivedAt: expect.any(Date),
    });
    expect(secondResult).toEqual(firstResult);
    expect(getStoredUser()).toEqual(firstResult);
    expect(update).toHaveBeenCalledOnce();
  });
});

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

type WebhookSyncClient = NonNullable<Parameters<typeof syncClerkUserCreated>[1]>;
type UserSyncData = Pick<User, "clerkUserId" | "email" | "status" | "archivedAt"> & {
  name?: string;
};
type UserSyncUpdate = Partial<UserSyncData>;
type UserLookup = { where: { clerkUserId: string } };

const createStatefulUserClient = (initialUser: User | null = null) => {
  let storedUser = initialUser;
  const findUnique = vi.fn(async ({ where }: UserLookup) =>
    storedUser?.clerkUserId === where.clerkUserId ? storedUser : null,
  );
  const create = vi.fn(async ({ data }: { data: UserSyncData }) => {
    if (storedUser) {
      throw { code: "P2002" };
    }
    storedUser = {
      ...createUser(data.status, data.archivedAt),
      ...data,
      name: data.name ?? null,
    };
    return storedUser;
  });
  const update = vi.fn(async ({ where, data }: UserLookup & { data: UserSyncUpdate }) => {
    if (!storedUser || storedUser.clerkUserId !== where.clerkUserId) {
      throw new Error("User not found.");
    }
    // Apply every supplied field, including lifecycle fields, as Prisma would.
    storedUser = {
      ...storedUser,
      ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
    };
    return storedUser;
  });
  const upsert = vi.fn(async (args: UserLookup & {
    create: UserSyncData;
    update: UserSyncUpdate;
  }) => {
    if (storedUser) {
      return update({ where: args.where, data: args.update });
    }
    return create({ data: args.create });
  });

  return {
    client: { findUnique, create, update, upsert } as unknown as WebhookSyncClient,
    getStoredUser: () => storedUser,
    update,
  };
};

type ReadRepairClient = NonNullable<
  Parameters<typeof syncClerkUserReadRepair>[1]
>;

const asReadRepairClient = (
  findUnique: unknown,
  create: unknown,
): ReadRepairClient =>
  ({ findUnique, create }) as ReadRepairClient;
