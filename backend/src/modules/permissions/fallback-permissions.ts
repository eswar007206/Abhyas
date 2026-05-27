/** Used when role_permissions seed is missing or incomplete (dev safety net). */
export const FALLBACK_PERMISSIONS_BY_ROLE: Record<string, readonly string[]> = {
  super_admin: [
    "platform.orgs.manage",
    "platform.billing.manage",
    "platform.support.impersonate",
    "content.questions.manage",
    "org.students.create",
    "org.students.manage",
    "org.seats.view",
    "org.billing.manage",
    "org.batches.manage",
    "org.teachers.manage",
    "org.tests.create",
  ],
  admin: [
    "org.students.create",
    "org.students.manage",
    "org.seats.view",
    "org.billing.manage",
    "org.batches.manage",
    "org.teachers.manage",
    "org.tests.create",
    "org.settings.manage",
  ],
  teacher: ["org.tests.create", "org.batches.manage"],
  branch_manager: [
    "org.students.create",
    "org.students.manage",
    "org.seats.view",
    "org.batches.manage",
  ],
  support_staff: ["platform.support.impersonate", "org.seats.view"],
  content_team: ["content.questions.manage"],
};

export function fallbackPermissionsForRoles(roleKeys: string[]): Set<string> {
  const permissions = new Set<string>();
  for (const roleKey of roleKeys) {
    const codes = FALLBACK_PERMISSIONS_BY_ROLE[roleKey];
    if (codes) {
      for (const code of codes) permissions.add(code);
    }
  }
  return permissions;
}
