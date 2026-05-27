import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../../config/env.js";
import { requirePermission } from "../../middleware/authorize.js";
import { requireProfile } from "../../middleware/auth.js";
import { requireTenantOrganizationMatch } from "../tenant/middleware.js";
import type { PaymentsService } from "./service.js";

const checkoutSchema = z.object({
  planSlug: z.string().trim().min(1),
});

const verifySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function registerPaymentRoutes(
  app: FastifyInstance,
  paymentsService: PaymentsService,
) {
  app.post("/api/payments/student/checkout", async (request, reply) => {
    const profile = requireProfile(request);
    const payload = checkoutSchema.parse(request.body);
    const checkout = await paymentsService.createStudentCheckout({
      userId: profile.id,
      planSlug: payload.planSlug,
    });
    return reply.send({ checkout });
  });

  app.post("/api/payments/organization/checkout", async (request, reply) => {
    requirePermission(request, "org.billing.manage");
    const profile = requireProfile(request);
    const payload = checkoutSchema.parse(request.body);
    if (!profile.organizationId) {
      return reply
        .code(400)
        .send({ error: "NO_ORGANIZATION", message: "No organization on profile." });
    }
    requireTenantOrganizationMatch(request, profile.organizationId);
    const checkout = await paymentsService.createOrganizationCheckout({
      organizationId: profile.organizationId,
      planSlug: payload.planSlug,
    });
    return reply.send({ checkout });
  });

  app.post("/api/payments/verify", async (request, reply) => {
    const profile = requireProfile(request);
    const payload = verifySchema.parse(request.body);
    const result = await paymentsService.verifyCheckout({
      profileId: profile.id,
      organizationId: profile.organizationId,
      ...payload,
    });
    return reply.send(result);
  });

  app.get("/api/payments/me", async (request) => {
    const profile = requireProfile(request);
    const payments = await paymentsService.listPaymentsForUser(profile.id);
    const invoices = await paymentsService.listInvoicesForPaymentIds(payments.map((p) => p.id));
    return { payments, invoices };
  });

  app.get("/api/org/billing", async (request) => {
    requirePermission(request, "org.billing.manage");
    const profile = requireProfile(request);
    if (!profile.organizationId) return { payments: [], invoices: [] };
    requireTenantOrganizationMatch(request, profile.organizationId);
    const payments = await paymentsService.listPaymentsForOrganization(profile.organizationId);
    const invoices = await paymentsService.listInvoicesForPaymentIds(payments.map((p) => p.id));
    return { payments, invoices };
  });
}

export async function registerPaymentWebhookRoutes(
  app: FastifyInstance,
  config: AppConfig,
  paymentsService: PaymentsService,
) {
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (!request.url?.includes("/api/webhooks/razorpay")) {
      return payload;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks);
    (request as { rawBody?: string }).rawBody = raw.toString("utf8");
    const { Readable } = await import("node:stream");
    return Readable.from([raw]);
  });

  app.post("/api/webhooks/razorpay", async (request, reply) => {
    if (!config.RAZORPAY_WEBHOOK_SECRET) {
      return reply.code(503).send({ error: "WEBHOOK_NOT_CONFIGURED" });
    }

    const signature = request.headers["x-razorpay-signature"]?.toString() ?? "";
    const rawBody =
      (request as { rawBody?: string }).rawBody ??
      (typeof request.body === "string" ? request.body : JSON.stringify(request.body));

    const result = await paymentsService.handleWebhook(
      rawBody,
      signature,
      config.RAZORPAY_WEBHOOK_SECRET,
    );
    return reply.send(result);
  });
}
