import type { AuthenticatedUser } from "./auth-service";

export interface ClerkUserLike {
  id: string;
  primaryEmailAddress?: { emailAddress?: string } | null;
}

export const mapClerkUserToInternalUser = (user: ClerkUserLike): AuthenticatedUser => ({
  id: user.id,
  clerkUserId: user.id,
  email: user.primaryEmailAddress?.emailAddress,
});
