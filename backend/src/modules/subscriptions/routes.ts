import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middleware/authorize.js";
import { requireProfile } from "../../middleware/auth.js";
import { requireTenantOrganizationMatch } from "../tenant/middleware.js";
import type { AppServices } from "../../services/index.js";
import type { SubscriptionsService } from "./service.js";

export async function registerSubscriptionRoutes(
  app: FastifyInstance,
  subscriptionsService: SubscriptionsService,
  services: AppServices,
) {
  app.get("/api/plans", async (request) => {
    requireProfile(request);
    const query = z
      .object({ audience: z.enum(["student", "organization"]).optional() })
      .parse(request.query ?? {});
    const plans = await subscriptionsService.listPlans(query.audience);
    return { plans };
  });

  app.get("/api/org/seats", async (request) => {
    requirePermission(request, "org.seats.view");
    const profile = requireProfile(request);
    if (!profile.organizationId) {
      return { seats: null };
    }

    requireTenantOrganizationMatch(request, profile.organizationId);
    const organization = await services.organization.getOrganization(profile.organizationId);
    return { seats: subscriptionsService.getSeatUsageForOrganization(organization) };
  });
}
