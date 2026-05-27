import { conflict, forbidden, notFound } from "../../http/errors.js";
import type { SubscriptionsRepository } from "../subscriptions/repository.js";
import type { PaymentRow, PaymentsRepository } from "./repository.js";
import type { RazorpayClient } from "./razorpay-client.js";

export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly razorpay: RazorpayClient,
  ) {}

  async createStudentCheckout(input: { userId: string; planSlug: string }) {
    if (!this.razorpay.isConfigured) {
      throw conflict("PAYMENTS_NOT_CONFIGURED", "Payment gateway is not configured.");
    }

    const plan = await this.subscriptionsRepository.findPlanBySlug(input.planSlug);
    if (!plan || plan.audience !== "student") {
      throw notFound("Student plan not found.");
    }

    const amountPaise = plan.price_monthly_inr * 100;
    const order = await this.razorpay.createOrder({
      amountPaise,
      currency: "INR",
      receipt: `student-${input.userId}-${Date.now()}`,
      notes: { planSlug: plan.slug, userId: input.userId },
    });

    const payment = await this.repository.insertPayment({
      userId: input.userId,
      planId: plan.id,
      amountPaise,
      razorpayOrderId: order.id,
      metadata: { planSlug: plan.slug },
    });

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      amountPaise,
      currency: order.currency,
      keyId: this.razorpay.publishableKeyId,
    };
  }

  async createOrganizationCheckout(input: { organizationId: string; planSlug: string }) {
    if (!this.razorpay.isConfigured) {
      throw conflict("PAYMENTS_NOT_CONFIGURED", "Payment gateway is not configured.");
    }

    const plan = await this.subscriptionsRepository.findPlanBySlug(input.planSlug);
    if (!plan || plan.audience !== "organization") {
      throw notFound("Organization plan not found.");
    }

    const amountPaise = plan.price_monthly_inr * 100;
    const order = await this.razorpay.createOrder({
      amountPaise,
      currency: "INR",
      receipt: `org-${input.organizationId}-${Date.now()}`,
      notes: { planSlug: plan.slug, organizationId: input.organizationId },
    });

    const payment = await this.repository.insertPayment({
      organizationId: input.organizationId,
      planId: plan.id,
      amountPaise,
      razorpayOrderId: order.id,
      metadata: { planSlug: plan.slug },
    });

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      amountPaise,
      currency: order.currency,
      keyId: this.razorpay.publishableKeyId,
    };
  }

  async verifyCheckout(input: {
    profileId: string;
    organizationId: string | null;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const payment = await this.repository.findByRazorpayOrderId(input.razorpayOrderId);
    if (!payment) throw notFound("Payment not found.");

    if (payment.user_id && payment.user_id !== input.profileId) {
      throw forbidden("This payment does not belong to your account.");
    }
    if (payment.organization_id) {
      if (!input.organizationId || payment.organization_id !== input.organizationId) {
        throw forbidden("This payment does not belong to your organization.");
      }
    }

    const valid = this.razorpay.verifyPaymentSignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });
    if (!valid) {
      throw conflict("PAYMENT_VERIFICATION_FAILED", "Payment signature verification failed.");
    }

    return this.activatePayment(input.razorpayOrderId, input.razorpayPaymentId);
  }

  async listPaymentsForUser(userId: string) {
    return this.repository.listByUserId(userId);
  }

  async listPaymentsForOrganization(organizationId: string) {
    return this.repository.listByOrganizationId(organizationId);
  }

  async listInvoicesForPaymentIds(paymentIds: string[]) {
    return this.repository.listInvoicesByPaymentIds(paymentIds);
  }

  getPlatformAnalytics() {
    return this.repository.getPlatformAnalytics();
  }

  async handleWebhook(rawBody: string, signature: string, webhookSecret: string) {
    const valid = this.razorpay.verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!valid) {
      throw conflict("WEBHOOK_SIGNATURE_INVALID", "Invalid webhook signature.");
    }

    const payload = JSON.parse(rawBody) as {
      event: string;
      payload?: { payment?: { entity?: { order_id?: string; id?: string } } };
    };

    const paymentEntity = payload.payload?.payment?.entity;
    const eventId = `${payload.event}-${paymentEntity?.id ?? Date.now()}`;
    const inserted = await this.repository.recordWebhookEvent({
      eventId,
      eventType: payload.event,
      payload: payload as Record<string, unknown>,
    });
    if (!inserted) return { duplicate: true };

    if (payload.event === "payment.captured" && paymentEntity?.order_id && paymentEntity.id) {
      await this.activatePayment(paymentEntity.order_id, paymentEntity.id);
    }

    return { ok: true };
  }

  private async activatePayment(razorpayOrderId: string, razorpayPaymentId: string) {
    const payment = await this.repository.findByRazorpayOrderId(razorpayOrderId);
    if (!payment) throw notFound("Payment not found.");

    if (payment.status === "captured") {
      return { paymentId: payment.id, alreadyCaptured: true as const };
    }

    await this.repository.markCaptured(payment.id, razorpayPaymentId);

    if (payment.user_id && payment.plan_id) {
      const subscription = await this.subscriptionsRepository.createUserSubscription({
        userId: payment.user_id,
        planId: payment.plan_id,
        status: "active",
      });
      await this.subscriptionsRepository.updateProfileSubscriptionStatus(payment.user_id, "active");
      await this.repository.insertInvoice({
        paymentId: payment.id,
        invoiceNumber: `INV-${payment.id.slice(0, 8).toUpperCase()}`,
        lineItems: [{ description: "Student subscription", amountPaise: payment.amount_paise }],
      });
      return { paymentId: payment.id, subscriptionId: subscription.id };
    }

    if (payment.organization_id && payment.plan_id) {
      const metadata = payment as PaymentRow & { metadata?: { planSlug?: string } };
      const planSlug =
        typeof metadata.metadata === "object" &&
        metadata.metadata &&
        "planSlug" in metadata.metadata
          ? String(metadata.metadata.planSlug)
          : "organization-450";
      const plan = await this.subscriptionsRepository.findPlanBySlug(planSlug);
      const seatLimit = plan?.seat_limit ?? 450;
      const subscription = await this.subscriptionsRepository.createOrganizationSubscription({
        organizationId: payment.organization_id,
        planId: payment.plan_id,
        seatCount: seatLimit,
        status: "active",
      });
      await this.subscriptionsRepository.updateOrganizationBilling({
        organizationId: payment.organization_id,
        planSlug,
        seatLimit,
      });
      await this.repository.insertInvoice({
        paymentId: payment.id,
        invoiceNumber: `INV-${payment.id.slice(0, 8).toUpperCase()}`,
        lineItems: [{ description: "Organization seat plan", amountPaise: payment.amount_paise }],
      });
      return { paymentId: payment.id, subscriptionId: subscription.id };
    }

    return { paymentId: payment.id };
  }
}
