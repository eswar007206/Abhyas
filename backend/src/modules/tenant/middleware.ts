import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../../config/env.js";
import { forbidden } from "../../http/errors.js";
import type { Profile } from "../../types/domain.js";
import { parseSubdomainFromHost } from "./parse-subdomain.js";
import type { TenantReader } from "./repository.interface.js";
import { EMPTY_TENANT_CONTEXT, type TenantContext } from "./types.js";

declare module "fastify" {
  interface FastifyRequest {
    tenant?: TenantContext;
  }
}

export function createTenantMiddleware(config: AppConfig, tenantRepository: TenantReader) {
  return async function resolveTenant(request: FastifyRequest, _reply: FastifyReply) {
    const headerTenant = request.headers["x-abhyas-tenant"]?.toString().trim().toLowerCase();
    const host =
      request.headers["x-forwarded-host"]?.toString() ?? request.headers.host?.toString();
    const subdomain =
      headerTenant || parseSubdomainFromHost(host, config.PLATFORM_ROOT_DOMAIN) || null;

    if (subdomain) {
      try {
        const organization = await tenantRepository.findOrganizationBySubdomain(subdomain);
        request.tenant = {
          organizationId: organization?.id ?? null,
          subdomain,
          resolvedBy: headerTenant ? "header" : "subdomain",
          organization,
        };
        return;
      } catch {
        // Tenant resolution should never hard-fail requests; fall back to empty context.
        request.tenant = { ...EMPTY_TENANT_CONTEXT };
        return;
      }
    }

    request.tenant = { ...EMPTY_TENANT_CONTEXT };
  };
}

export function attachProfileTenant(
  request: FastifyRequest,
  profile: Profile,
  tenantRepository: TenantReader,
): Promise<void> {
  if (request.tenant?.organizationId || !profile.organizationId) {
    return Promise.resolve();
  }

  return tenantRepository
    .findOrganizationById(profile.organizationId)
    .then((organization) => {
      request.tenant = {
        organizationId: profile.organizationId,
        subdomain: organization?.subdomain ?? null,
        resolvedBy: "profile",
        organization,
      };
    })
    .catch(() => {
      request.tenant = { ...EMPTY_TENANT_CONTEXT };
    });
}

export function requireTenantOrganizationMatch(
  request: FastifyRequest,
  organizationId: string,
): void {
  const tenantOrgId = request.tenant?.organizationId;
  if (!tenantOrgId || tenantOrgId === organizationId) return;
  throw forbidden("This action is not allowed for the resolved tenant.");
}
