import {
  FirstUserBootstrapOutcomes,
  type FirstUserBootstrapOutcome,
} from "../tenancy/bootstrap-outcome";

export type FirstAccessFailureReason =
  | "USER_READ_REPAIR_FAILED"
  | "BOOTSTRAP_FAILED";

export interface FirstAccessAuthorizationState {
  isAuthenticated: boolean;
  isAuthorized: boolean;
  reason?: string;
}

export interface InternalAuthorizationResolution<
  TContext extends FirstAccessAuthorizationState = FirstAccessAuthorizationState,
> {
  context: TContext;
  internalUserId: string | null;
}

export interface FirstAccessFlowDependencies<
  TContext extends FirstAccessAuthorizationState,
> {
  resolveInternalContext(): Promise<InternalAuthorizationResolution<TContext>>;
  repairUser(): Promise<boolean>;
  bootstrapUser(userId: string): Promise<FirstUserBootstrapOutcome>;
  createFailureResolution(
    reason: FirstAccessFailureReason,
    internalUserId: string | null,
  ): InternalAuthorizationResolution<TContext>;
}

export const runAuthenticatedFirstAccessFlow = async <
  TContext extends FirstAccessAuthorizationState,
>(
  dependencies: FirstAccessFlowDependencies<TContext>,
): Promise<InternalAuthorizationResolution<TContext>> => {
  let resolution = await dependencies.resolveInternalContext();

  if (!resolution.context.isAuthenticated || resolution.context.isAuthorized) {
    return resolution;
  }

  if (resolution.context.reason === "USER_NOT_FOUND") {
    try {
      const repaired = await dependencies.repairUser();
      if (!repaired) {
        return dependencies.createFailureResolution("USER_READ_REPAIR_FAILED", null);
      }

      resolution = await dependencies.resolveInternalContext();
    } catch {
      return dependencies.createFailureResolution("USER_READ_REPAIR_FAILED", null);
    }

    if (resolution.context.reason === "USER_NOT_FOUND") {
      return dependencies.createFailureResolution("USER_READ_REPAIR_FAILED", null);
    }
  }

  if (!resolution.context.isAuthenticated || resolution.context.isAuthorized) {
    return resolution;
  }

  if (
    resolution.context.reason !== "MEMBERSHIP_NOT_FOUND" ||
    !resolution.internalUserId
  ) {
    return resolution;
  }

  try {
    const bootstrapOutcome = await dependencies.bootstrapUser(
      resolution.internalUserId,
    );
    if (bootstrapOutcome === FirstUserBootstrapOutcomes.notEligible) {
      return resolution;
    }

    const finalResolution = await dependencies.resolveInternalContext();

    return finalResolution.context.isAuthorized
      ? finalResolution
      : dependencies.createFailureResolution(
          "BOOTSTRAP_FAILED",
          resolution.internalUserId,
        );
  } catch {
    return dependencies.createFailureResolution(
      "BOOTSTRAP_FAILED",
      resolution.internalUserId,
    );
  }
};

export const repairAuthenticatedUser = async <TUser extends { id: string }>(
  authenticatedClerkUserId: string,
  resolveTrustedUser: () => Promise<TUser | null>,
  synchronizeUser: (user: TUser) => Promise<unknown>,
) => {
  const trustedUser = await resolveTrustedUser();
  if (!trustedUser || trustedUser.id !== authenticatedClerkUserId) {
    return false;
  }

  await synchronizeUser(trustedUser);
  return true;
};
