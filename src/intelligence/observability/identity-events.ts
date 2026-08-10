import { logger, type Logger } from "../shared/logger";

export const IdentityEventNames = {
  userSyncCreated: "identity.user_sync.created",
  userSyncUpdated: "identity.user_sync.updated",
  userSyncDeactivated: "identity.user_sync.deactivated",
  userSyncFailed: "identity.user_sync.failed",
  bootstrapStarted: "identity.bootstrap.started",
  bootstrapCompleted: "identity.bootstrap.completed",
  bootstrapFailed: "identity.bootstrap.failed",
  authorizationResolved: "identity.authorization.resolved",
  authorizationDenied: "identity.authorization.denied",
  webhookVerificationFailed: "identity.webhook.verification_failed",
  webhookProcessingFailed: "identity.webhook.processing_failed",
} as const;

export type IdentityEventName = (typeof IdentityEventNames)[keyof typeof IdentityEventNames];
export type IdentityEventSeverity = "info" | "warn" | "error";

export interface IdentityEvent {
  event: IdentityEventName;
  timestamp: string;
  severity: IdentityEventSeverity;
  userId?: string;
  clerkUserId?: string;
  tenantId?: string;
  organizationId?: string;
  membershipId?: string;
  reason?: string;
  operation?: string;
}

export type IdentityEventInput = Omit<IdentityEvent, "timestamp"> & {
  timestamp?: string;
};

export interface IdentityEventEmitter {
  emit(event: IdentityEvent): void;
}

const safeIdentityEventKeys = new Set<keyof IdentityEvent>([
  "event",
  "timestamp",
  "severity",
  "userId",
  "clerkUserId",
  "tenantId",
  "organizationId",
  "membershipId",
  "reason",
  "operation",
]);

class LoggerIdentityEventEmitter implements IdentityEventEmitter {
  constructor(private readonly output: Logger = logger) {}

  emit(event: IdentityEvent) {
    const message = "maia.identity_event";
    const metadata = { ...sanitizeIdentityEvent(event) };

    if (event.severity === "error") {
      this.output.error(message, metadata);
      return;
    }

    if (event.severity === "warn") {
      this.output.warn(message, metadata);
      return;
    }

    this.output.info(message, metadata);
  }
}

let identityEventEmitter: IdentityEventEmitter = new LoggerIdentityEventEmitter();

export const emitIdentityEvent = (input: IdentityEventInput) => {
  const event = sanitizeIdentityEvent({
    ...input,
    timestamp: input.timestamp ?? new Date().toISOString(),
  });

  try {
    identityEventEmitter.emit(event);
  } catch {
    // Observability must never change identity or authorization outcomes.
  }
};

export const setIdentityEventEmitterForTesting = (emitter: IdentityEventEmitter) => {
  const previousEmitter = identityEventEmitter;
  identityEventEmitter = emitter;
  return () => {
    identityEventEmitter = previousEmitter;
  };
};

export const sanitizeIdentityEvent = (event: IdentityEvent): IdentityEvent => {
  const sanitizedEvent = {} as IdentityEvent;

  for (const [key, value] of Object.entries(event) as Array<
    [keyof IdentityEvent, IdentityEvent[keyof IdentityEvent]]
  >) {
    if (!safeIdentityEventKeys.has(key) || value === undefined || value === "") {
      continue;
    }

    sanitizedEvent[key] = value as never;
  }

  return sanitizedEvent;
};
