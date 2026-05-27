import type { FastifyReply, FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "../http/errors.js";
import { attachProfileTenant } from "../modules/tenant/middleware.js";
import type { TenantReader } from "../modules/tenant/repository.interface.js";
import type { AppServices } from "../services/index.js";
import type { AuthUser, Profile, UserRole } from "../types/domain.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
    profile?: Profile;
  }
}

export function createAuthMiddleware(services: AppServices, tenantRepository: TenantReader) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

    if (!token) {
      throw unauthorized();
    }

    const user = await services.auth.getUserFromToken(token);
    if (!user) {
      throw unauthorized("Invalid or expired token.");
    }

    const profile = await services.profile.getProfileById(user.id);
    if (!profile) {
      throw forbidden("Profile not found.");
    }

    request.authUser = user;
    request.profile = profile;
    await attachProfileTenant(request, profile, tenantRepository);

    if (services.permissions) {
      request.authorization = await services.permissions.buildAuthorizationContext(profile);
    }
  };
}

export function requireProfile(request: FastifyRequest): Profile {
  if (!request.profile) {
    throw unauthorized();
  }
  return request.profile;
}

export function requireRole(request: FastifyRequest, roles: UserRole[]): Profile {
  const profile = requireProfile(request);
  if (!roles.includes(profile.role)) {
    throw forbidden();
  }
  return profile;
}
