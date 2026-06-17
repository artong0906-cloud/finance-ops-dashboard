export type UserRole = "admin" | "finance" | "executive" | "viewer";

export function canUpload(role: UserRole) {
  return role === "admin" || role === "finance";
}

export function canManageUsers(role: UserRole) {
  return role === "admin";
}
