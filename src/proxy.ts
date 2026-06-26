import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAuthenticationProtectedRoute = createRouteMatcher([
  "/app(.*)",
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/settings(.*)",
  "/api/app(.*)",
  "/api/internal(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isAuthenticationProtectedRoute(request)) {
    // SPEC-001 Phase 2: authenticate only. MAIA tenant and membership authorization stay server-side.
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/app(.*)",
    "/dashboard(.*)",
    "/onboarding(.*)",
    "/settings(.*)",
    "/api/app(.*)",
    "/api/internal(.*)",
  ],
};
