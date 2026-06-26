import type { AuthenticatedUser } from "@/intelligence/authentication/auth-service";
import type { Permission, SensitiveAccessLevel } from "@/intelligence/contracts/enums";
import type { ProductContextId } from "@/intelligence/contracts/types";

export interface RequestContext {
  requestId: string;
  tenantId: string;
  user: AuthenticatedUser;
  role: string;
  permissions: Permission[];
  productContext: ProductContextId;
  organization?: Record<string, unknown>;
  sensitiveAccess: SensitiveAccessLevel;
}
