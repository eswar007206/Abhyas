import type { Organization } from "../../types/domain.js";
import type { TenantReader } from "./repository.interface.js";

function stubOrganization(id: string): Organization {
  return {
    id,
    name: "Stub Organization",
    contact_email: null,
    seat_limit: 0,
    status: "active",
    subdomain: null,
    plan_slug: null,
    active_students: 0,
    branding: {},
    feature_flags: {},
  };
}

/** Used when the app is built with injected mock services (tests). */
export function createStubTenantRepository(): TenantReader {
  return {
    findOrganizationBySubdomain: async () => null,
    findOrganizationById: async (id: string) => stubOrganization(id),
  };
}
