import { createId } from "@/intelligence/shared/ids";
import type { SensitiveAuditLog } from "./audit-types";

export class AuditService {
  private readonly logs: SensitiveAuditLog[] = [];

  recordSensitiveAccess(input: Omit<SensitiveAuditLog, "id" | "createdAt">) {
    const log: SensitiveAuditLog = {
      ...input,
      id: createId("audit"),
      createdAt: new Date().toISOString(),
    };
    this.logs.push(log);
    return log;
  }

  listTenantLogs(tenantId: string) {
    return this.logs.filter((log) => log.tenantId === tenantId);
  }
}
