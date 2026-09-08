import type { AuthorizationContext } from "./authorization-context";

export type AuthorizationResolver = () => Promise<AuthorizationContext>;

export const resolveServerAuthorizationContext: AuthorizationResolver = async () => {
  const { resolveAuthorizationContext } = await import("./authorization-context");
  return resolveAuthorizationContext();
};
