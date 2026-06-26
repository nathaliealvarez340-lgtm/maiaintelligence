import { MaiaError } from "@/intelligence/shared/errors";

export class AuthorizationError extends MaiaError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, 403, details);
    this.name = "AuthorizationError";
  }
}
