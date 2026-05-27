import type { SupabaseClient } from "@supabase/supabase-js";

export interface PaymentRow {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  plan_id: string | null;
  subscription_id: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  amount_paise: number;
  currency: string;
  status: string;
}

export class PaymentsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async insertPayment(input: {
    userId?: string | null;
    organizationId?: string | null;
    planId: string;
    amountPaise: number;
    razorpayOrderId: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentRow> {
    const { data, error } = await this.supabase
      .from("payments")
      .insert({
        user_id: input.userId ?? null,
        organization_id: input.organizationId ?? null,
        plan_id: input.planId,
        amount_paise: input.amountPaise,
        razorpay_order_id: input.razorpayOrderId,
        status: "created",
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();

    if (error || !data) throw error ?? new Error("Payment insert failed.");
    return data as PaymentRow;
  }

  async findByRazorpayOrderId(orderId: string): Promise<PaymentRow | null> {
    const { data, error } = await this.supabase
      .from("payments")
      .select("*")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();

    if (error) throw error;
    return data as PaymentRow | null;
  }

  async markCaptured(paymentId: string, razorpayPaymentId: string): Promise<void> {
    const { error } = await this.supabase
      .from("payments")
      .update({
        status: "captured",
        razorpay_payment_id: razorpayPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);
    if (error) throw error;
  }

  async insertInvoice(input: {
    paymentId: string;
    invoiceNumber: string;
    lineItems: Record<string, unknown>[];
    gstin?: string | null;
  }): Promise<void> {
    const { error } = await this.supabase.from("invoices").insert({
      payment_id: input.paymentId,
      invoice_number: input.invoiceNumber,
      line_items: input.lineItems,
      gstin: input.gstin ?? null,
    });
    if (error) throw error;
  }

  async recordWebhookEvent(input: {
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<boolean> {
    const { error } = await this.supabase.from("payment_webhook_events").insert({
      provider: "razorpay",
      event_id: input.eventId,
      event_type: input.eventType,
      payload: input.payload,
      processed_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === "23505") return false;
      throw error;
    }
    return true;
  }

  async listByUserId(userId: string): Promise<PaymentRow[]> {
    const { data, error } = await this.supabase
      .from("payments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as PaymentRow[];
  }

  async listByOrganizationId(organizationId: string): Promise<PaymentRow[]> {
    const { data, error } = await this.supabase
      .from("payments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as PaymentRow[];
  }

  async listInvoicesByPaymentIds(paymentIds: string[]) {
    if (paymentIds.length === 0) return [];
    const { data, error } = await this.supabase
      .from("invoices")
      .select("*")
      .in("payment_id", paymentIds)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getPlatformAnalytics() {
    const [paymentsResult, orgsResult] = await Promise.all([
      this.supabase.from("payments").select("amount_paise, status, user_id, organization_id"),
      this.supabase.from("organizations").select("status"),
    ]);

    if (paymentsResult.error) throw paymentsResult.error;
    if (orgsResult.error) throw orgsResult.error;

    const captured = (paymentsResult.data ?? []).filter((row) => row.status === "captured");
    const revenuePaise = captured.reduce((sum, row) => sum + Number(row.amount_paise ?? 0), 0);
    const studentPayments = captured.filter((row) => row.user_id && !row.organization_id).length;
    const organizationPayments = captured.filter((row) => row.organization_id).length;
    const orgs = orgsResult.data ?? [];

    return {
      capturedPayments: captured.length,
      revenueInr: Math.round(revenuePaise / 100),
      activeOrganizations: orgs.filter((org) => org.status === "active").length,
      suspendedOrganizations: orgs.filter((org) => org.status === "suspended").length,
      studentPayments,
      organizationPayments,
    };
  }
}
