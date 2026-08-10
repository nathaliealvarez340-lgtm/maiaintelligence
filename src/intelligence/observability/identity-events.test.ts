import { describe, expect, it } from "vitest";

import {
  emitIdentityEvent,
  IdentityEventNames,
  sanitizeIdentityEvent,
  setIdentityEventEmitterForTesting,
  type IdentityEvent,
} from "./identity-events";

describe("identity events", () => {
  it("omits sensitive and unsupported properties", () => {
    const event = sanitizeIdentityEvent({
      event: IdentityEventNames.authorizationDenied,
      timestamp: "2026-08-10T00:00:00.000Z",
      severity: "warn",
      userId: "user_1",
      clerkUserId: "clerk_1",
      reason: "TENANT_ACCESS_DENIED",
      email: "person@example.com",
      token: "secret-token",
      webhookSignature: "signature",
      rawPayload: { private: true },
    } as IdentityEvent & Record<string, unknown>);

    expect(event).toEqual({
      event: IdentityEventNames.authorizationDenied,
      timestamp: "2026-08-10T00:00:00.000Z",
      severity: "warn",
      userId: "user_1",
      clerkUserId: "clerk_1",
      reason: "TENANT_ACCESS_DENIED",
    });
  });

  it("does not throw when event emission fails", () => {
    const restoreEmitter = setIdentityEventEmitterForTesting({
      emit() {
        throw new Error("logger unavailable");
      },
    });

    expect(() =>
      emitIdentityEvent({
        event: IdentityEventNames.authorizationDenied,
        severity: "warn",
        reason: "MEMBERSHIP_NOT_FOUND",
      }),
    ).not.toThrow();

    restoreEmitter();
  });
});
