export interface AITrace {
  id: string;
  requestId: string;
  tenantId: string;
  productContext: string;
  providerId: string;
  summary: string;
  createdAt: string;
}

export interface SensitiveAuditLog {
  id: string;
  tenantId: string;
  userId?: string;
  action: string;
  resource: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
