import { verifyWebhook } from "@clerk/nextjs/webhooks";
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

  // Phase 5 will perform user synchronization. Phase 4 only verifies and acknowledges.
  return NextResponse.json({
    received: true,
    type: event.type,
  });
}
