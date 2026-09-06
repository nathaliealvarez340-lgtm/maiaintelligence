import { describe, expect, it, vi } from "vitest";

import { FirstUserBootstrapOutcomes } from "../tenancy/bootstrap-outcome";
import {
  repairAuthenticatedUser,
  runAuthenticatedFirstAccessFlow,
  type FirstAccessFailureReason,
  type InternalAuthorizationResolution,
} from "./first-access-flow";

interface TestAuthorizationContext {
  isAuthenticated: boolean;
  isAuthorized: boolean;
  reason?: string;
  userId?: string;
  tenantId?: string;
  organizationId?: string;
  membershipId?: string;
  role?: string;
  permissions?: string[];
}

const authorizedContext: TestAuthorizationContext = {
  isAuthenticated: true,
  isAuthorized: true,
  userId: "user_1",
  tenantId: "tenant_1",
  organizationId: "organization_1",
  membershipId: "membership_1",
  role: "OWNER",
  permissions: ["chat:use", "memory:read"],
};

const unauthorizedContext = (reason: string): TestAuthorizationContext => ({
  isAuthenticated: true,
  isAuthorized: false,
  reason,
});

const resolution = (
  context: TestAuthorizationContext,
  internalUserId: string | null,
): InternalAuthorizationResolution<TestAuthorizationContext> => ({
  context,
  internalUserId,
});

const failureResolution = (
  reason: FirstAccessFailureReason,
  internalUserId: string | null,
) => resolution(unauthorizedContext(reason), internalUserId);

describe("authenticated first-access flow", () => {
  it("returns an existing authorized context without repair or bootstrap", async () => {
    const repairUser = vi.fn(async () => true);
    const bootstrapUser = vi.fn(async () => FirstUserBootstrapOutcomes.succeeded);

    const result = await runAuthenticatedFirstAccessFlow({
      resolveInternalContext: vi.fn(async () =>
        resolution(authorizedContext, "user_1"),
      ),
      repairUser,
      bootstrapUser,
      createFailureResolution: failureResolution,
    });

    expect(result.context).toEqual(authorizedContext);
    expect(repairUser).not.toHaveBeenCalled();
    expect(bootstrapUser).not.toHaveBeenCalled();
  });

  it("retrieves trusted Clerk identity and repairs a missing user", async () => {
    let repaired = false;
    const resolveTrustedUser = vi.fn(async () => ({ id: "clerk_1" }));
    const synchronizeUser = vi.fn(async () => {
      repaired = true;
    });
    const bootstrapUser = vi.fn(async () => FirstUserBootstrapOutcomes.succeeded);
    const resolveInternalContext = vi.fn(async () =>
      repaired
        ? resolution(authorizedContext, "user_1")
        : resolution(unauthorizedContext("USER_NOT_FOUND"), null),
    );

    const result = await runAuthenticatedFirstAccessFlow({
      resolveInternalContext,
      repairUser: () =>
        repairAuthenticatedUser("clerk_1", resolveTrustedUser, synchronizeUser),
      bootstrapUser,
      createFailureResolution: failureResolution,
    });

    expect(result.context).toEqual(authorizedContext);
    expect(resolveTrustedUser).toHaveBeenCalledOnce();
    expect(synchronizeUser).toHaveBeenCalledOnce();
    expect(resolveInternalContext).toHaveBeenCalledTimes(2);
    expect(bootstrapUser).not.toHaveBeenCalled();
  });

  it("fails closed when trusted Clerk identity retrieval fails", async () => {
    const bootstrapUser = vi.fn(async () => FirstUserBootstrapOutcomes.succeeded);

    const result = await runAuthenticatedFirstAccessFlow({
      resolveInternalContext: vi.fn(async () =>
        resolution(unauthorizedContext("USER_NOT_FOUND"), null),
      ),
      repairUser: () =>
        repairAuthenticatedUser(
          "clerk_1",
          async () => {
            throw new Error("Clerk unavailable");
          },
          vi.fn(async () => undefined),
        ),
      bootstrapUser,
      createFailureResolution: failureResolution,
    });

    expect(result.context).toMatchObject({
      isAuthorized: false,
      reason: "USER_READ_REPAIR_FAILED",
    });
    expect(bootstrapUser).not.toHaveBeenCalled();
  });

  it("fails closed and skips bootstrap when user synchronization fails", async () => {
    const bootstrapUser = vi.fn(async () => FirstUserBootstrapOutcomes.succeeded);

    const result = await runAuthenticatedFirstAccessFlow({
      resolveInternalContext: vi.fn(async () =>
        resolution(unauthorizedContext("USER_NOT_FOUND"), null),
      ),
      repairUser: () =>
        repairAuthenticatedUser(
          "clerk_1",
          async () => ({ id: "clerk_1" }),
          async () => {
            throw new Error("Database unavailable");
          },
        ),
      bootstrapUser,
      createFailureResolution: failureResolution,
    });

    expect(result.context).toMatchObject({
      isAuthorized: false,
      reason: "USER_READ_REPAIR_FAILED",
    });
    expect(bootstrapUser).not.toHaveBeenCalled();
  });

  it("keeps a read-repaired inactive user unauthorized", async () => {
    const resolveInternalContext = vi
      .fn<
        () => Promise<
          InternalAuthorizationResolution<TestAuthorizationContext>
        >
      >()
      .mockResolvedValueOnce(
        resolution(unauthorizedContext("USER_NOT_FOUND"), null),
      )
      .mockResolvedValueOnce(
        resolution(unauthorizedContext("USER_INACTIVE"), "user_1"),
      );
    const bootstrapUser = vi.fn(async () => FirstUserBootstrapOutcomes.succeeded);

    const result = await runAuthenticatedFirstAccessFlow({
      resolveInternalContext,
      repairUser: vi.fn(async () => true),
      bootstrapUser,
      createFailureResolution: failureResolution,
    });

    expect(result.context).toMatchObject({
      isAuthorized: false,
      reason: "USER_INACTIVE",
    });
    expect(resolveInternalContext).toHaveBeenCalledTimes(2);
    expect(bootstrapUser).not.toHaveBeenCalled();
  });

  it("rejects trusted identity that does not match the authenticated session", async () => {
    const synchronizeUser = vi.fn(async () => undefined);

    await expect(
      repairAuthenticatedUser(
        "clerk_authenticated",
        async () => ({ id: "clerk_other" }),
        synchronizeUser,
      ),
    ).resolves.toBe(false);

    expect(synchronizeUser).not.toHaveBeenCalled();
  });

  it("repairs and bootstraps the first eligible user before final resolution", async () => {
    let state: "missing-user" | "missing-membership" | "authorized" =
      "missing-user";
    const repairUser = vi.fn(async () => {
      state = "missing-membership";
      return true;
    });
    const bootstrapUser = vi.fn(async (userId: string) => {
      expect(userId).toBe("user_1");
      state = "authorized";
      return FirstUserBootstrapOutcomes.succeeded;
    });
    const resolveInternalContext = vi.fn(async () => {
      if (state === "missing-user") {
        return resolution(unauthorizedContext("USER_NOT_FOUND"), null);
      }
      if (state === "missing-membership") {
        return resolution(
          unauthorizedContext("MEMBERSHIP_NOT_FOUND"),
          "user_1",
        );
      }
      return resolution(authorizedContext, "user_1");
    });

    const result = await runAuthenticatedFirstAccessFlow({
      resolveInternalContext,
      repairUser,
      bootstrapUser,
      createFailureResolution: failureResolution,
    });

    expect(result.context).toEqual(authorizedContext);
    expect(repairUser).toHaveBeenCalledOnce();
    expect(bootstrapUser).toHaveBeenCalledOnce();
    expect(resolveInternalContext).toHaveBeenCalledTimes(3);
  });

  it("preserves MEMBERSHIP_NOT_FOUND when bootstrap is not eligible", async () => {
    const bootstrapUser = vi.fn(
      async () => FirstUserBootstrapOutcomes.notEligible,
    );
    const resolveInternalContext = vi.fn(async () =>
      resolution(unauthorizedContext("MEMBERSHIP_NOT_FOUND"), "user_2"),
    );

    const result = await runAuthenticatedFirstAccessFlow({
      resolveInternalContext,
      repairUser: vi.fn(async () => true),
      bootstrapUser,
      createFailureResolution: failureResolution,
    });

    expect(result.context).toMatchObject({
      isAuthorized: false,
      reason: "MEMBERSHIP_NOT_FOUND",
    });
    expect(bootstrapUser).toHaveBeenCalledOnce();
    expect(resolveInternalContext).toHaveBeenCalledOnce();
  });

  it("does not repeat repair or bootstrap after first access succeeds", async () => {
    let state: "missing-user" | "missing-membership" | "authorized" =
      "missing-user";
    const repairUser = vi.fn(async () => {
      state = "missing-membership";
      return true;
    });
    const bootstrapUser = vi.fn(async () => {
      state = "authorized";
      return FirstUserBootstrapOutcomes.succeeded;
    });
    const dependencies = {
      resolveInternalContext: vi.fn(async () => {
        if (state === "missing-user") {
          return resolution(unauthorizedContext("USER_NOT_FOUND"), null);
        }
        if (state === "missing-membership") {
          return resolution(
            unauthorizedContext("MEMBERSHIP_NOT_FOUND"),
            "user_1",
          );
        }
        return resolution(authorizedContext, "user_1");
      }),
      repairUser,
      bootstrapUser,
      createFailureResolution: failureResolution,
    };

    await runAuthenticatedFirstAccessFlow(dependencies);
    await runAuthenticatedFirstAccessFlow(dependencies);

    expect(repairUser).toHaveBeenCalledOnce();
    expect(bootstrapUser).toHaveBeenCalledOnce();
  });

  it("fails closed when bootstrap throws", async () => {
    const result = await runAuthenticatedFirstAccessFlow({
      resolveInternalContext: vi.fn(async () =>
        resolution(unauthorizedContext("MEMBERSHIP_NOT_FOUND"), "user_1"),
      ),
      repairUser: vi.fn(async () => true),
      bootstrapUser: vi.fn(async () => {
        throw new Error("Database unavailable");
      }),
      createFailureResolution: failureResolution,
    });

    expect(result.context).toMatchObject({
      isAuthorized: false,
      reason: "BOOTSTRAP_FAILED",
    });
  });

  it("fails closed when successful bootstrap does not resolve authorization", async () => {
    const resolveInternalContext = vi.fn(async () =>
      resolution(unauthorizedContext("MEMBERSHIP_NOT_FOUND"), "user_1"),
    );

    const result = await runAuthenticatedFirstAccessFlow({
      resolveInternalContext,
      repairUser: vi.fn(async () => true),
      bootstrapUser: vi.fn(async () => FirstUserBootstrapOutcomes.succeeded),
      createFailureResolution: failureResolution,
    });

    expect(result.context).toMatchObject({
      isAuthorized: false,
      reason: "BOOTSTRAP_FAILED",
    });
    expect(resolveInternalContext).toHaveBeenCalledTimes(2);
  });

  it("returns authorization values exclusively from final internal resolution", async () => {
    const finalResolution = resolution(authorizedContext, "user_1");
    const resolveInternalContext = vi
      .fn<
        () => Promise<
          InternalAuthorizationResolution<TestAuthorizationContext>
        >
      >()
      .mockResolvedValueOnce(
        resolution(unauthorizedContext("MEMBERSHIP_NOT_FOUND"), "user_1"),
      )
      .mockResolvedValueOnce(finalResolution);
    const bootstrapUser = vi.fn(async () => FirstUserBootstrapOutcomes.succeeded);

    const result = await runAuthenticatedFirstAccessFlow({
      resolveInternalContext,
      repairUser: vi.fn(async () => true),
      bootstrapUser,
      createFailureResolution: failureResolution,
    });

    expect(result.context).toBe(finalResolution.context);
    expect(resolveInternalContext).toHaveBeenCalledTimes(2);
    expect(bootstrapUser).toHaveBeenCalledOnce();
    expect(bootstrapUser).toHaveBeenCalledWith("user_1");
    expect(resolveInternalContext.mock.invocationCallOrder[0]).toBeLessThan(
      bootstrapUser.mock.invocationCallOrder[0],
    );
    expect(resolveInternalContext.mock.invocationCallOrder[1]).toBeGreaterThan(
      bootstrapUser.mock.invocationCallOrder[0],
    );
  });
});
