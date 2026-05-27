import type { Profile } from "../../types/domain.js";
import { fallbackPermissionsForRoles } from "./fallback-permissions.js";
import type { PermissionsRepository } from "./repository.js";
import type { AuthorizationContext, OrgMemberRole, PlatformRole } from "./types.js";

function mapProfileRoleToPlatformRoles(profile: Profile): PlatformRole[] {
  if (profile.role === "developer") return ["super_admin"];
  return [];
}

function mapProfileRoleToOrgRole(profile: Profile): OrgMemberRole | null {
  if (profile.role === "organization_admin") return "admin";
  if (profile.role === "student") return "student";
  return null;
}

export class PermissionsService {
  constructor(private readonly repository: PermissionsRepository) {}

  async buildAuthorizationContext(profile: Profile): Promise<AuthorizationContext> {
    const platformRoles = [
      ...mapProfileRoleToPlatformRoles(profile),
      ...(await this.repository.listPlatformRoles(profile.id)),
    ];
    const uniquePlatformRoles = [...new Set(platformRoles)] as PlatformRole[];

    let orgRole = mapProfileRoleToOrgRole(profile);
    if (profile.organizationId) {
      const membershipRole = await this.repository.findOrgMembershipRole(
        profile.id,
        profile.organizationId,
      );
      if (membershipRole) orgRole = membershipRole;
    }

    const roleKeys: string[] = [...uniquePlatformRoles];
    if (orgRole) roleKeys.push(orgRole);

    const permissionCodes = await this.repository.listPermissionsForRoles(roleKeys);
    const permissions = new Set([...fallbackPermissionsForRoles(roleKeys), ...permissionCodes]);

    return {
      userId: profile.id,
      platformRoles: uniquePlatformRoles,
      orgRole,
      organizationId: profile.organizationId,
      permissions,
    };
  }

  hasPermission(context: AuthorizationContext, permission: string): boolean {
    return context.permissions.has(permission);
  }
}
