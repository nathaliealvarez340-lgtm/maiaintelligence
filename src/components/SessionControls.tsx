"use client";

import { SignOutButton, useAuth } from "@clerk/nextjs";

export default function SessionControls() {
  const { isLoaded, sessionId } = useAuth();

  if (!isLoaded || !sessionId) {
    return null;
  }

  return (
    <header
      aria-label="Session controls"
      style={{ display: "flex", justifyContent: "flex-end", padding: "12px 20px" }}
    >
      <SignOutButton
        signOutOptions={{
          sessionId,
          redirectUrl: "/sign-in",
        }}
      >
        <button
          type="button"
          style={{
            minHeight: 44,
            padding: "8px 16px",
            border: "1px solid #6b7280",
            borderRadius: 4,
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </SignOutButton>
    </header>
  );
}
