import type { SupabaseClient } from "@supabase/supabase-js";
import type { Organization, Profile } from "../../types/domain.js";

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

function toProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    role: row.role as Profile["role"],
    accountType: row.account_type as Profile["accountType"],
    organizationId: row.organization_id ? String(row.organization_id) : null,
    freeTestLimit: Number(row.free_test_limit),
    subscriptionStatus: row.subscription_status as Profile["subscriptionStatus"],
    state: row.state ? String(row.state) : null,
    city: row.city ? String(row.city) : null,
  };
}

export interface CreateOrganizationRecordInput {
  name: string;
  contactEmail: string;
  seatLimit: number;
  subdomain?: string | null;
  planSlug?: string | null;
}

export class OrganizationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async insertOrganization(input: CreateOrganizationRecordInput): Promise<Organization> {
    const { data, error } = await this.supabase
      .from("organizations")
      .insert({
        name: input.name,
        contact_email: input.contactEmail,
        seat_limit: input.seatLimit,
        status: "active",
        subdomain: input.subdomain ?? null,
        plan_slug: input.planSlug ?? null,
      })
      .select(
        "id, name, contact_email, seat_limit, status, subdomain, plan_slug, active_students, branding, feature_flags",
      )
      .single();

    if (error || !data) throw error ?? new Error("Organization insert failed.");
    return toOrganization(data as Record<string, unknown>);
  }

  async findById(id: string): Promise<Organization | null> {
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

  async countActiveStudents(organizationId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("organization_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("role", "student")
      .eq("status", "active");

    if (error) throw error;
    return count ?? 0;
  }

  async upsertAdminMembership(organizationId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.from("organization_memberships").upsert({
      organization_id: organizationId,
      user_id: userId,
      role: "admin",
      status: "active",
    });
    if (error) throw error;
  }

  async upsertStudentMembership(organizationId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.from("organization_memberships").upsert({
      organization_id: organizationId,
      user_id: userId,
      role: "student",
      status: "active",
    });
    if (error) throw error;
  }

  async isOrganizationAdmin(userId: string, organizationId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("organization_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("role", "admin")
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  async findStudentProfile(studentId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", studentId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toProfile(data as Record<string, unknown>);
  }

  async listOrganizations(input: {
    query?: string;
    status?: string;
    limit?: number;
  }): Promise<Organization[]> {
    let query = this.supabase
      .from("organizations")
      .select(
        "id, name, contact_email, seat_limit, status, subdomain, plan_slug, active_students, branding, feature_flags",
      )
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 100);

    if (input.status) {
      query = query.eq("status", input.status);
    }
    if (input.query?.trim()) {
      const term = `%${input.query.trim()}%`;
      query = query.or(`name.ilike.${term},contact_email.ilike.${term},subdomain.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => toOrganization(row as Record<string, unknown>));
  }

  async updateStatus(id: string, status: string): Promise<Organization> {
    const { data, error } = await this.supabase
      .from("organizations")
      .update({ status })
      .eq("id", id)
      .select(
        "id, name, contact_email, seat_limit, status, subdomain, plan_slug, active_students, branding, feature_flags",
      )
      .single();

    if (error || !data) throw error ?? new Error("Organization update failed.");
    return toOrganization(data as Record<string, unknown>);
  }

  async updateSeatLimit(id: string, seatLimit: number): Promise<Organization> {
    const { data, error } = await this.supabase
      .from("organizations")
      .update({ seat_limit: seatLimit })
      .eq("id", id)
      .select(
        "id, name, contact_email, seat_limit, status, subdomain, plan_slug, active_students, branding, feature_flags",
      )
      .single();

    if (error || !data) throw error ?? new Error("Seat limit update failed.");
    return toOrganization(data as Record<string, unknown>);
  }

  async updateFeatureFlags(
    id: string,
    featureFlags: Record<string, unknown>,
  ): Promise<Organization> {
    const { data, error } = await this.supabase
      .from("organizations")
      .update({ feature_flags: featureFlags })
      .eq("id", id)
      .select(
        "id, name, contact_email, seat_limit, status, subdomain, plan_slug, active_students, branding, feature_flags",
      )
      .single();

    if (error || !data) throw error ?? new Error("Feature flags update failed.");
    return toOrganization(data as Record<string, unknown>);
  }

  async updateSettings(
    id: string,
    input: {
      name?: string;
      contactEmail?: string;
      branding?: Record<string, unknown>;
    },
  ): Promise<Organization> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.contactEmail !== undefined) patch.contact_email = input.contactEmail;
    if (input.branding !== undefined) patch.branding = input.branding;

    const { data, error } = await this.supabase
      .from("organizations")
      .update(patch)
      .eq("id", id)
      .select(
        "id, name, contact_email, seat_limit, status, subdomain, plan_slug, active_students, branding, feature_flags",
      )
      .single();

    if (error || !data) throw error ?? new Error("Organization settings update failed.");
    return toOrganization(data as Record<string, unknown>);
  }
}
