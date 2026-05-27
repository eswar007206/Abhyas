import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeacherProfile } from "./types.js";

function toTeacherProfile(row: Record<string, unknown>): TeacherProfile {
  return {
    userId: String(row.user_id),
    organizationId: String(row.organization_id),
    subjects: Array.isArray(row.subjects) ? (row.subjects as string[]) : [],
    bio: row.bio ? String(row.bio) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

export class TeachersRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async upsertTeacherProfile(input: {
    userId: string;
    organizationId: string;
    subjects: string[];
    bio: string | null;
  }): Promise<TeacherProfile> {
    const { data, error } = await this.supabase
      .from("teacher_profiles")
      .upsert({
        user_id: input.userId,
        organization_id: input.organizationId,
        subjects: input.subjects,
        bio: input.bio,
      })
      .select("*")
      .single();

    if (error || !data) throw error ?? new Error("Teacher profile upsert failed.");
    return toTeacherProfile(data as Record<string, unknown>);
  }

  async listByOrganization(organizationId: string): Promise<TeacherProfile[]> {
    const { data, error } = await this.supabase
      .from("teacher_profiles")
      .select("*")
      .eq("organization_id", organizationId);

    if (error) throw error;
    return (data ?? []).map((row) => toTeacherProfile(row as Record<string, unknown>));
  }

  async upsertTeacherMembership(organizationId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.from("organization_memberships").upsert({
      organization_id: organizationId,
      user_id: userId,
      role: "teacher",
      status: "active",
    });
    if (error) throw error;
  }
}
