import type { ProductContextId } from "./types";

export interface SprintChatRequest {
  requestId: string;
  tenantId: string;
  productContext: ProductContextId;
  message: string;
}

export interface SprintChatResponse {
  requestId: string;
  tenantId: string;
  productContext: ProductContextId;
  assistantMessage: string;
  traceId: string;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}
