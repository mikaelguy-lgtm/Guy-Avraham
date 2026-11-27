// Deep-link mapping shared by the Recent Activity feed (AdminHome) and the
// SUPER_ADMIN notification bell/list — both surface the same entityType/
// entityId shape and must resolve to the same admin screen.
export function adminEntityLink(entityType: string | null, entityId: number | null): string {
  if (entityType === "client" && entityId) return `/admin/cases/${entityId}`;
  if (entityType === "user") return "/admin/advisors";
  if (entityType === "privacy_request") return "/admin/settings/privacy-requests";
  if (entityType === "email_outbox") return "/admin/email-logs";
  return "/admin";
}
