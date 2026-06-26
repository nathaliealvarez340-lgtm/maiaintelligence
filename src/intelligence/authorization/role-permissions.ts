import { Permissions, type Permission, type Role } from "@/intelligence/contracts/enums";

export const rolePermissions: Record<Role, Permission[]> = {
  owner: [Permissions.chatUse, Permissions.memoryRead, Permissions.memoryWrite, Permissions.auditRead],
  admin: [Permissions.chatUse, Permissions.memoryRead, Permissions.memoryWrite, Permissions.auditRead],
  member: [Permissions.chatUse, Permissions.memoryRead, Permissions.memoryWrite],
  viewer: [Permissions.chatUse, Permissions.memoryRead],
};

export const roleHasPermission = (role: Role, permission: Permission) =>
  rolePermissions[role]?.includes(permission) ?? false;
