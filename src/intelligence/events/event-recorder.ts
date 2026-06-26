import { createId } from "@/intelligence/shared/ids";
import type { IntelligenceEvent } from "./event-types";

export class EventRecorder {
  private readonly events: IntelligenceEvent[] = [];

  record(input: Omit<IntelligenceEvent, "id" | "createdAt">) {
    const event: IntelligenceEvent = {
      ...input,
      id: createId("event"),
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }
}
