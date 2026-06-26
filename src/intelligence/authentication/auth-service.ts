import { MaiaError } from "@/intelligence/shared/errors";

export interface AuthenticatedUser {
  id: string;
  clerkUserId: string;
  email?: string;
}

export interface AuthenticationAdapter {
  resolveUser(): Promise<AuthenticatedUser | null>;
}

export class AuthService {
  constructor(private readonly adapter: AuthenticationAdapter) {}

  async requireUser() {
    const user = await this.adapter.resolveUser();
    if (!user) {
      throw new MaiaError("UNAUTHENTICATED", "Authentication is required.", 401);
    }
    return user;
  }
}
