import { createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { config } from "./proxy";

type BoundaryHandler = (
  auth: { protect: () => Promise<void> },
  request: NextRequest,
) => Promise<void>;

const boundary = vi.hoisted(() => ({ handler: undefined as BoundaryHandler | undefined }));

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return {
    ...original,
    clerkMiddleware: (handler: BoundaryHandler) => {
      boundary.handler = handler;
      return vi.fn();
    },
  };
});

const requestFor = (path: string) => new NextRequest(`https://maia.example${path}`);
const matchesProxy = createRouteMatcher(config.matcher);

describe("Clerk session request boundary", () => {
  it.each([
    "/app",
    "/app/private",
    "/dashboard",
    "/onboarding",
    "/settings",
    "/api/app",
    "/api/internal",
  ])("delegates authentication of %s to Clerk", async (path) => {
    const request = requestFor(path);
    const protect = vi.fn(async () => {});

    expect(matchesProxy(request)).toBe(true);
    await boundary.handler!({ protect }, request);

    expect(protect).toHaveBeenCalledExactlyOnceWith();
  });

  it("propagates Clerk's denial when a session is no longer authenticated", async () => {
    const request = requestFor("/app/private");
    const protect = vi.fn<() => Promise<void>>().mockResolvedValueOnce(undefined);
    await expect(boundary.handler!({ protect }, request)).resolves.toBeUndefined();

    const clerkDenial = new Error("Clerk requires authentication.");
    protect.mockRejectedValueOnce(clerkDenial);

    await expect(boundary.handler!({ protect }, request)).rejects.toBe(clerkDenial);
    expect(protect).toHaveBeenCalledTimes(2);
  });

  it.each([
    "/",
    "/sign-in",
    "/sign-in/factor-one",
    "/sign-up",
    "/sign-up/verify-email-address",
  ])("keeps the public authentication destination %s outside protection", async (path) => {
    const request = requestFor(path);
    const protect = vi.fn(async () => {});

    expect(matchesProxy(request)).toBe(false);
    await boundary.handler!({ protect }, request);

    expect(protect).not.toHaveBeenCalled();
  });
});
