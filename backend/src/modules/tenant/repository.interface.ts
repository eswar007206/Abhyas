import type { Organization } from "../../types/domain.js";

export interface TenantReader {
  findOrganizationBySubdomain(subdomain: string): Promise<Organization | null>;
  findOrganizationById(id: string): Promise<Organization | null>;
}
