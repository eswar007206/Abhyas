import type { Organization } from "../../types/domain.js";

export type TenantResolutionSource = "subdomain" | "header" | "profile" | "none";

export interface TenantContext {
  organizationId: string | null;
  subdomain: string | null;
  resolvedBy: TenantResolutionSource;
  organization: Organization | null;
}

export const EMPTY_TENANT_CONTEXT: TenantContext = {
  organizationId: null,
  subdomain: null,
  resolvedBy: "none",
  organization: null,
};
