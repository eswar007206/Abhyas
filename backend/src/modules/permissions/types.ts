export type PlatformRole = "super_admin" | "support_staff" | "content_team";
export type OrgMemberRole = "admin" | "student" | "teacher" | "parent" | "branch_manager";

export interface AuthorizationContext {
  userId: string;
  platformRoles: PlatformRole[];
  orgRole: OrgMemberRole | null;
  organizationId: string | null;
  permissions: ReadonlySet<string>;
}
