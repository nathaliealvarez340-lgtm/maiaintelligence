import { describe, expect, it, vi } from "vitest";

import { FirstUserBootstrapOutcomes } from "./bootstrap-outcome";
import { runSerializedFirstUserBootstrap } from "./bootstrap-transaction";

describe("serialized first-user bootstrap", () => {
  it("acquires serialization before authoritative eligibility and creation", async () => {
    const calls: string[] = [];

    const result = await runSerializedFirstUserBootstrap({
      acquireSerialization: async () => {
        calls.push("lock");
        return () => {
          calls.push("release");
        };
      },
      resolveSubject: async () => {
        calls.push("subject");
        return "user_1";
      },
      resolveExistingOwner: async () => {
        calls.push("existing-owner");
        return null;
      },
      hasEstablishedState: async () => {
        calls.push("eligibility");
        return false;
      },
      onBootstrapStarted: () => {
        calls.push("started");
      },
      createInitialOwner: async () => {
        calls.push("create");
        return "user_1";
      },
    });

    expect(result).toEqual({
      outcome: FirstUserBootstrapOutcomes.succeeded,
      value: "user_1",
      performed: true,
    });
    expect(calls).toEqual([
      "lock",
      "subject",
      "existing-owner",
      "eligibility",
      "started",
      "create",
      "release",
    ]);
  });

  it("returns not eligible without starting or creating bootstrap state", async () => {
    const onBootstrapStarted = vi.fn();
    const createInitialOwner = vi.fn(async () => "user_2");

    const result = await runSerializedFirstUserBootstrap({
      acquireSerialization: async () => () => undefined,
      resolveSubject: async () => "user_2",
      resolveExistingOwner: async () => null,
      hasEstablishedState: async () => true,
      onBootstrapStarted,
      createInitialOwner,
    });

    expect(result).toEqual({
      outcome: FirstUserBootstrapOutcomes.notEligible,
      performed: false,
    });
    expect(onBootstrapStarted).not.toHaveBeenCalled();
    expect(createInitialOwner).not.toHaveBeenCalled();
  });

  it("resolves concurrent requests for the same user to one owner", async () => {
    const acquireSerialization = createSerializationGate();
    let ownerUserId: string | null = null;
    let creationCount = 0;
    let startedCount = 0;

    const runForUser = (userId: string) =>
      runSerializedFirstUserBootstrap({
        acquireSerialization,
        resolveSubject: async () => userId,
        resolveExistingOwner: async (subjectUserId) =>
          ownerUserId === subjectUserId ? ownerUserId : null,
        hasEstablishedState: async () => ownerUserId !== null,
        onBootstrapStarted: () => {
          startedCount += 1;
        },
        createInitialOwner: async (subjectUserId) => {
          creationCount += 1;
          ownerUserId = subjectUserId;
          return subjectUserId;
        },
      });

    const results = await Promise.all([
      runForUser("user_1"),
      runForUser("user_1"),
    ]);

    expect(results.every(
      (result) => result.outcome === FirstUserBootstrapOutcomes.succeeded,
    )).toBe(true);
    expect(results.filter((result) => result.performed)).toHaveLength(1);
    expect(startedCount).toBe(1);
    expect(creationCount).toBe(1);
    expect(ownerUserId).toBe("user_1");
  });

  it("allows exactly one owner across concurrent requests from different users", async () => {
    const acquireSerialization = createSerializationGate();
    let ownerUserId: string | null = null;
    let creationCount = 0;
    let startedCount = 0;

    const runForUser = (userId: string) =>
      runSerializedFirstUserBootstrap({
        acquireSerialization,
        resolveSubject: async () => userId,
        resolveExistingOwner: async (subjectUserId) =>
          ownerUserId === subjectUserId ? ownerUserId : null,
        hasEstablishedState: async () => ownerUserId !== null,
        onBootstrapStarted: () => {
          startedCount += 1;
        },
        createInitialOwner: async (subjectUserId) => {
          creationCount += 1;
          ownerUserId = subjectUserId;
          return subjectUserId;
        },
      });

    const results = await Promise.all([
      runForUser("user_1"),
      runForUser("user_2"),
    ]);

    expect(results.filter(
      (result) => result.outcome === FirstUserBootstrapOutcomes.succeeded,
    )).toHaveLength(1);
    expect(results.filter(
      (result) => result.outcome === FirstUserBootstrapOutcomes.notEligible,
    )).toHaveLength(1);
    expect(startedCount).toBe(1);
    expect(creationCount).toBe(1);
    expect(ownerUserId).not.toBeNull();
  });
});

const createSerializationGate = () => {
  let locked = false;
  const waiters: Array<() => void> = [];

  return async () => {
    if (locked) {
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    }

    locked = true;
    let released = false;

    return () => {
      if (released) {
        return;
      }
      released = true;

      const next = waiters.shift();
      if (next) {
        next();
      } else {
        locked = false;
      }
    };
  };
};
