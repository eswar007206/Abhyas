import { notFound } from "../../http/errors.js";
import { getSeatUsage } from "../seat-management/service.js";
import type { Organization } from "../../types/domain.js";
import type { SubscriptionsRepository } from "./repository.js";

export class SubscriptionsService {
  constructor(private readonly repository: SubscriptionsRepository) {}

  async provisionOrganizationTrial(organization: Organization, planSlug: string) {
    const plan = await this.repository.findPlanBySlug(planSlug);
    if (!plan || plan.audience !== "organization") {
      throw notFound("Organization plan not found.");
    }

    return this.repository.createOrganizationSubscription({
      organizationId: organization.id,
      planId: plan.id,
      seatCount: organization.seat_limit,
      status: "active",
    });
  }

  getSeatUsageForOrganization(organization: Organization) {
    return getSeatUsage(organization);
  }

  listPlans(audience?: "student" | "organization") {
    return this.repository.listPlans(audience);
  }
}
