import type { Permission, Role } from "@/intelligence/contracts/enums";
import { AuthorizationError } from "./authorization-errors";
import { roleHasPermission } from "./role-permissions";
import { validateTenantMembership, type TenantMembership } from "./tenant-guard";

export interface PermissionGuardInput {
  tenantId: string;
  membership: TenantMembership | null;
  requiredRole?: Role;
  requiredPermission: Permission;
}

export const assertPermission = (input: PermissionGuardInput) => {
  const membership = validateTenantMembership(input.tenantId, input.membership);
  const role = membership.role as Role;

  if (input.requiredRole && role !== input.requiredRole) {
    throw new AuthorizationError("ROLE_DENIED", "User role is not allowed.", {
      requiredRole: input.requiredRole,
      actualRole: role,
    });
  }

  if (!roleHasPermission(role, input.requiredPermission)) {
    throw new AuthorizationError("PERMISSION_DENIED", "User permission is not allowed.", {
      requiredPermission: input.requiredPermission,
      actualRole: role,
    });
  }

  return membership;
};
