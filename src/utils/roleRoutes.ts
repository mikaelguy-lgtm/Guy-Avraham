import type { UserRole } from "../types";

export function homePathForRole(role: UserRole): string {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "/admin";
  if (role === "ADVISOR") return "/advisor";
  return "/lender";
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canAccessSmtpSettings(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}
