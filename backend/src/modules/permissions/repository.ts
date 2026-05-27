import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgMemberRole, PlatformRole } from "./types.js";

export class PermissionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listPlatformRoles(userId: string): Promise<PlatformRole[]> {
    const { data, error } = await this.supabase
      .from("platform_user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) throw error;
    return (data ?? []).map((row) => row.role as PlatformRole);
  }

  async findOrgMembershipRole(
    userId: string,
    organizationId: string,
  ): Promise<OrgMemberRole | null> {
    const { data, error } = await this.supabase
      .from("organization_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    return data ? (data.role as OrgMemberRole) : null;
  }

  async listPermissionsForRoles(roleKeys: string[]): Promise<string[]> {
    if (roleKeys.length === 0) return [];

    const { data, error } = await this.supabase
      .from("role_permissions")
      .select("permission_code")
      .in("role_key", roleKeys);

    if (error) throw error;
    return [...new Set((data ?? []).map((row) => row.permission_code as string))];
  }
}
