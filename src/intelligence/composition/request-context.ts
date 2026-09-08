import type { AuthenticatedUser } from "@/intelligence/authentication/auth-service";
import type { SensitiveAccessLevel } from "@/intelligence/contracts/enums";
import type { ProductContextId } from "@/intelligence/contracts/types";
import type { AuthorizedContext } from "../authorization/authorization-context";

export interface RequestContext {
  requestId: string;
  tenantId: string;
  user: AuthenticatedUser;
  membershipId: AuthorizedContext["membershipId"];
  role: AuthorizedContext["role"];
  permissions: AuthorizedContext["permissions"];
  productContext: ProductContextId;
  organization?: Record<string, unknown>;
  sensitiveAccess: SensitiveAccessLevel;
}
