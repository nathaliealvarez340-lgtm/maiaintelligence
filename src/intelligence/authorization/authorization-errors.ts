import { MaiaError } from "../shared/errors";

export class AuthorizationError extends MaiaError {
  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    status = 403,
  ) {
    super(code, message, status, details);
    this.name = "AuthorizationError";
  }
}
