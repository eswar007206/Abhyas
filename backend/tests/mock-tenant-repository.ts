import { vi } from "vitest";
import type { TenantRepository } from "../src/modules/tenant/repository.js";
import type { Organization } from "../src/types/domain.js";

function demoOrganization(id: string): Organization {
  return {
    id,
    name: "Demo Org",
    contact_email: "admin@demo.test",
    seat_limit: 450,
    status: "active",
    subdomain: "demo",
    plan_slug: null,
    active_students: 0,
    branding: {},
    feature_flags: {},
  };
}

export function createMockTenantRepository(): TenantRepository {
  return {
    findOrganizationBySubdomain: vi.fn(async () => null),
    findOrganizationById: vi.fn(async (id: string) => demoOrganization(id)),
  } as unknown as TenantRepository;
}
