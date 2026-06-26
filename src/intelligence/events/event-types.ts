export interface IntelligenceEvent {
  id: string;
  type: "chat.requested" | "chat.completed" | "memory.changed";
  tenantId: string;
  productContext: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
