import type { FastifyRequest } from "fastify";
import { forbidden } from "../http/errors.js";
import type { AuthorizationContext } from "../modules/permissions/types.js";
import { requireProfile } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    authorization?: AuthorizationContext;
  }
}

export function requirePermission(request: FastifyRequest, permission: string): void {
  requireProfile(request);
  const authorization = request.authorization;
  if (!authorization) {
    throw forbidden("Authorization context is unavailable.");
  }
  if (!authorization.permissions.has(permission)) {
    throw forbidden(`Missing permission: ${permission}`);
  }
}

export function requireAnyPermission(request: FastifyRequest, permissions: string[]): void {
  requireProfile(request);
  const authorization = request.authorization;
  if (!authorization) {
    throw forbidden("Authorization context is unavailable.");
  }
  const allowed = permissions.some((permission) => authorization.permissions.has(permission));
  if (!allowed) {
    throw forbidden("You are not allowed to perform this action.");
  }
}
