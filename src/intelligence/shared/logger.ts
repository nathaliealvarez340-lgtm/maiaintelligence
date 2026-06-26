export interface Logger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

const safeMetadata = (metadata?: Record<string, unknown>) =>
  metadata ? JSON.stringify(metadata) : "";

export const logger: Logger = {
  info(message, metadata) {
    console.info(message, safeMetadata(metadata));
  },
  warn(message, metadata) {
    console.warn(message, safeMetadata(metadata));
  },
  error(message, metadata) {
    console.error(message, safeMetadata(metadata));
  },
};
