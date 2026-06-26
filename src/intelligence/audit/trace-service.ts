import { createId } from "@/intelligence/shared/ids";
import type { AITrace } from "./audit-types";

export class TraceService {
  private readonly traces: AITrace[] = [];

  createTrace(input: Omit<AITrace, "id" | "createdAt">) {
    const trace: AITrace = {
      ...input,
      id: createId("trace"),
      createdAt: new Date().toISOString(),
    };
    this.traces.push(trace);
    return trace;
  }

  getTrace(id: string) {
    return this.traces.find((trace) => trace.id === id) ?? null;
  }
}
