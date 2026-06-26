import { AuthorizationError } from "./authorization-errors";

export interface TenantMembership {
  tenantId: string;
  userId: string;
  role: string;
  active: boolean;
}

export const validateTenantMembership = (
  tenantId: string,
  membership: TenantMembership | null,
) => {
  if (!tenantId) {
    throw new AuthorizationError("TENANT_REQUIRED", "tenantId is required.");
  }
  if (!membership || membership.tenantId !== tenantId) {
    throw new AuthorizationError("TENANT_ACCESS_DENIED", "User does not belong to this tenant.");
  }
  if (!membership.active) {
    throw new AuthorizationError("TENANT_MEMBERSHIP_INACTIVE", "Tenant membership is inactive.");
  }
  return membership;
};
