import { verifyWebhook } from "@clerk/nextjs/webhooks";
import {
  ClerkUserSyncError,
  deactivateClerkUserDeleted,
  syncClerkUserCreated,
  syncClerkUserUpdated,
} from "@/intelligence/authentication/user-sync";
import { type NextRequest, NextResponse } from "next/server";

const supportedClerkUserEvents = new Set([
  "user.created",
  "user.updated",
  "user.deleted",
]);

export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;

  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook request." },
      { status: 400 },
    );
  }

  if (!supportedClerkUserEvents.has(event.type)) {
    return NextResponse.json({
      received: true,
      ignored: true,
      type: event.type,
    });
  }

  try {
    if (event.type === "user.created") {
      await syncClerkUserCreated(event.data);
    }

    if (event.type === "user.updated") {
      await syncClerkUserUpdated(event.data);
    }

    if (event.type === "user.deleted") {
      await deactivateClerkUserDeleted(event.data);
    }
  } catch (error) {
    if (error instanceof ClerkUserSyncError) {
      return NextResponse.json(
        { error: "Clerk user synchronization failed." },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { error: "Clerk webhook processing failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    received: true,
    type: event.type,
  });
}
