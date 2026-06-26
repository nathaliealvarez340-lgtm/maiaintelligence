import { MaiaError } from "@/intelligence/shared/errors";

export class CoreError extends MaiaError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, 500, details);
    this.name = "CoreError";
  }
}
