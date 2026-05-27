import type { SupabaseClient } from "@supabase/supabase-js";
import type { Organization } from "../../types/domain.js";
import type { TenantReader } from "./repository.interface.js";

function toOrganization(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    name: String(row.name),
    contact_email: row.contact_email ? String(row.contact_email) : null,
    seat_limit: Number(row.seat_limit),
    status: String(row.status),
    subdomain: row.subdomain ? String(row.subdomain) : null,
    plan_slug: row.plan_slug ? String(row.plan_slug) : null,
    active_students: Number(row.active_students ?? 0),
    branding: (row.branding as Organization["branding"]) ?? {},
    feature_flags: (row.feature_flags as Organization["feature_flags"]) ?? {},
  };
}

export class TenantRepository implements TenantReader {
  constructor(private readonly supabase: SupabaseClient) {}

  async findOrganizationBySubdomain(subdomain: string): Promise<Organization | null> {
    const { data, error } = await this.supabase
      .from("organizations")
      .select(
        "id, name, contact_email, seat_limit, status, subdomain, plan_slug, active_students, branding, feature_flags",
      )
      .eq("subdomain", subdomain)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toOrganization(data as Record<string, unknown>);
  }

  async findOrganizationById(id: string): Promise<Organization | null> {
    const { data, error } = await this.supabase
      .from("organizations")
      .select(
        "id, name, contact_email, seat_limit, status, subdomain, plan_slug, active_students, branding, feature_flags",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toOrganization(data as Record<string, unknown>);
  }
}
