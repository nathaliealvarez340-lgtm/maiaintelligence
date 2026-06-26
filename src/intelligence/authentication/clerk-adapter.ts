import type { AuthenticatedUser, AuthenticationAdapter } from "./auth-service";
import { mapClerkUserToInternalUser, type ClerkUserLike } from "./user-sync";

export type ClerkUserResolver = () => Promise<ClerkUserLike | null>;

export class ClerkAuthenticationAdapter implements AuthenticationAdapter {
  constructor(private readonly resolveClerkUser: ClerkUserResolver) {}

  async resolveUser(): Promise<AuthenticatedUser | null> {
    const clerkUser = await this.resolveClerkUser();
    return clerkUser ? mapClerkUserToInternalUser(clerkUser) : null;
  }
}
