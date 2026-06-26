export const Roles = {
  owner: "owner",
  admin: "admin",
  member: "member",
  viewer: "viewer",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const Permissions = {
  chatUse: "chat:use",
  memoryRead: "memory:read",
  memoryWrite: "memory:write",
  auditRead: "audit:read",
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const MemoryReviewStatuses = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  archived: "archived",
} as const;

export type MemoryReviewStatus =
  (typeof MemoryReviewStatuses)[keyof typeof MemoryReviewStatuses];

export const SensitiveAccessLevels = {
  none: "none",
  metadata: "metadata",
  full: "full",
} as const;

export type SensitiveAccessLevel =
  (typeof SensitiveAccessLevels)[keyof typeof SensitiveAccessLevels];
