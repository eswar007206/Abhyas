import type { SupabaseClient } from "@supabase/supabase-js";

export interface PlanRow {
  id: string;
  slug: string;
  name: string;
  audience: "student" | "organization";
  price_monthly_inr: number;
  seat_limit: number | null;
}

export class SubscriptionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findPlanBySlug(slug: string): Promise<PlanRow | null> {
    const { data, error } = await this.supabase
      .from("plans")
      .select("id, slug, name, audience, price_monthly_inr, seat_limit")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    return data as PlanRow | null;
  }

  async createOrganizationSubscription(input: {
    organizationId: string;
    planId: string;
    seatCount: number;
    status: string;
  }): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from("subscriptions")
      .insert({
        organization_id: input.organizationId,
        plan_id: input.planId,
        seat_count: input.seatCount,
        status: input.status as "active",
      })
      .select("id")
      .single();

    if (error || !data) throw error ?? new Error("Subscription insert failed.");
    return { id: data.id as string };
  }

  async createUserSubscription(input: {
    userId: string;
    planId: string;
    status: string;
    currentPeriodEnd?: string | null;
  }): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from("subscriptions")
      .insert({
        user_id: input.userId,
        plan_id: input.planId,
        status: input.status,
        current_period_end: input.currentPeriodEnd ?? null,
      })
      .select("id")
      .single();

    if (error || !data) throw error ?? new Error("Subscription insert failed.");
    return { id: data.id as string };
  }

  async activateSubscription(subscriptionId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from("subscriptions")
      .update({ status })
      .eq("id", subscriptionId);
    if (error) throw error;
  }

  async updateProfileSubscriptionStatus(
    userId: string,
    status: "free" | "trialing" | "active" | "past_due" | "cancelled",
  ): Promise<void> {
    const { error } = await this.supabase
      .from("profiles")
      .update({ subscription_status: status })
      .eq("id", userId);
    if (error) throw error;
  }

  async listPlans(audience?: "student" | "organization"): Promise<PlanRow[]> {
    let query = this.supabase
      .from("plans")
      .select("id, slug, name, audience, price_monthly_inr, seat_limit")
      .eq("is_active", true)
      .order("price_monthly_inr");

    if (audience) query = query.eq("audience", audience);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PlanRow[];
  }

  async updateOrganizationBilling(input: {
    organizationId: string;
    planSlug: string;
    seatLimit: number;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("organizations")
      .update({
        plan_slug: input.planSlug,
        seat_limit: input.seatLimit,
      })
      .eq("id", input.organizationId);
    if (error) throw error;
  }
}
