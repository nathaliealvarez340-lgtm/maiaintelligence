export class MaiaError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 500,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MaiaError";
  }
}

export const toMaiaError = (error: unknown) =>
  error instanceof MaiaError
    ? error
    : new MaiaError("INTERNAL_ERROR", "An unexpected MAIA Intelligence error occurred.");
