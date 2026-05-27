import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAnyPermission, requirePermission } from "../../middleware/authorize.js";
import { requireProfile, requireRole } from "../../middleware/auth.js";
import type { AppServices } from "../../services/index.js";
import { requireTenantOrganizationMatch } from "../tenant/middleware.js";
import type { AuditRepository } from "./repository.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function registerAuditRoutes(
  app: FastifyInstance,
  auditRepository: AuditRepository,
  services: AppServices,
  supabase: SupabaseClient,
) {
  app.get("/api/platform/audit-logs", async (request) => {
    requireAnyPermission(request, ["platform.orgs.manage"]);
    requireRole(request, ["developer"]);
    const query = z
      .object({ limit: z.coerce.number().int().positive().max(200).optional() })
      .parse(request.query);
    const logs = await auditRepository.listPlatform(query.limit ?? 100);
    return { logs };
  });

  app.get("/api/org/audit-logs", async (request) => {
    requirePermission(request, "org.settings.manage");
    const profile = requireProfile(request);
    if (!profile.organizationId) return { logs: [] };
    requireTenantOrganizationMatch(request, profile.organizationId);
    const query = z
      .object({ limit: z.coerce.number().int().positive().max(100).optional() })
      .parse(request.query);
    const logs = await auditRepository.listForOrganization(
      profile.organizationId,
      query.limit ?? 50,
    );
    return { logs };
  });

  app.get("/api/platform/analytics", async (request) => {
    requireAnyPermission(request, ["platform.orgs.manage"]);
    requireRole(request, ["developer"]);
    if (!services.payments) {
      return {
        analytics: {
          capturedPayments: 0,
          revenueInr: 0,
          activeOrganizations: 0,
          suspendedOrganizations: 0,
          studentPayments: 0,
          organizationPayments: 0,
        },
      };
    }
    const analytics = await services.payments.getPlatformAnalytics();
    return { analytics };
  });

  app.post("/api/platform/impersonate", async (request, reply) => {
    const profile = requireProfile(request);
    requireAnyPermission(request, ["platform.support.impersonate"]);
    requireRole(request, ["developer"]);
    const payload = z
      .object({
        targetUserId: z.string().uuid(),
        reason: z.string().trim().min(3).max(500),
        durationMinutes: z.coerce.number().int().positive().max(120).optional(),
      })
      .parse(request.body);

    const expiresAt = new Date(
      Date.now() + (payload.durationMinutes ?? 30) * 60 * 1000,
    ).toISOString();

    const { data: targetProfile, error: targetError } = await supabase
      .from("profiles")
      .select("id, email, full_name, organization_id")
      .eq("id", payload.targetUserId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!targetProfile) {
      return reply.code(404).send({ error: "NOT_FOUND", message: "Target user not found." });
    }

    const { data: session, error: sessionError } = await supabase
      .from("impersonation_sessions")
      .insert({
        actor_id: profile.id,
        target_user_id: payload.targetUserId,
        organization_id: targetProfile.organization_id,
        reason: payload.reason,
        expires_at: expiresAt,
        metadata: { initiatedBy: profile.email },
      })
      .select("*")
      .single();
    if (sessionError) throw sessionError;

    await auditRepository.insert({
      actorId: profile.id,
      organizationId: targetProfile.organization_id,
      action: "platform.impersonation_started",
      entityType: "impersonation_session",
      entityId: session.id,
      metadata: {
        targetUserId: payload.targetUserId,
        reason: payload.reason,
        expiresAt,
      },
    });

    return reply.code(201).send({
      session,
      target: {
        id: targetProfile.id,
        email: targetProfile.email,
        fullName: targetProfile.full_name,
      },
      message:
        "Impersonation session recorded. Exchange to target credentials requires your support login flow.",
    });
  });
}
