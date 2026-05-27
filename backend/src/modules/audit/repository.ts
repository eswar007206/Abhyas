import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  organization_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export class AuditRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async insert(input: {
    actorId: string | null;
    organizationId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from("audit_logs").insert({
      actor_id: input.actorId,
      organization_id: input.organizationId ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) throw error;
  }

  async listForOrganization(organizationId: string, limit = 50): Promise<AuditLogRow[]> {
    const { data, error } = await this.supabase
      .from("audit_logs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as AuditLogRow[];
  }

  async listPlatform(limit = 100): Promise<AuditLogRow[]> {
    const { data, error } = await this.supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as AuditLogRow[];
  }
}
