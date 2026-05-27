import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { AppConfig } from "./config/env.js";
import { loadConfig } from "./config/env.js";
import { HttpError } from "./http/errors.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerBatchRoutes } from "./modules/batches/routes.js";
import { registerAuditRoutes } from "./modules/audit/routes.js";
import { registerOrganizationRoutes } from "./modules/organization/routes.js";
import { registerPaymentRoutes, registerPaymentWebhookRoutes } from "./modules/payments/routes.js";
import { registerSubscriptionRoutes } from "./modules/subscriptions/routes.js";
import { registerTeacherRoutes } from "./modules/teachers/routes.js";
import { createTenantMiddleware } from "./modules/tenant/middleware.js";
import { TenantRepository } from "./modules/tenant/repository.js";
import type { TenantReader } from "./modules/tenant/repository.interface.js";
import { createStubTenantRepository } from "./modules/tenant/stub-repository.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerTestRoutes } from "./routes/tests.js";
import { createSupabaseAdmin } from "./lib/supabase.js";
import type { AppServices } from "./services/index.js";
import { createAppServices, type ExtendedAppServices } from "./services/create-app-services.js";

interface BuildAppOptions {
  config?: AppConfig;
  services?: AppServices;
  tenantRepository?: TenantReader;
}

const testConfig: AppConfig = {
  NODE_ENV: "test",
  PORT: 0,
  CORS_ORIGIN: "http://localhost:5173",
  PLATFORM_ROOT_DOMAIN: "abhyas.in",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  RATE_LIMIT_MAX: 10_000,
  RATE_LIMIT_WINDOW: "1 minute",
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? (options.services ? testConfig : loadConfig());
  const services = options.services ?? createAppServices(config);
  const tenantRepository =
    options.tenantRepository ??
    (options.services
      ? createStubTenantRepository()
      : new TenantRepository(createSupabaseAdmin(config)));

  const app = Fastify({
    logger: config.NODE_ENV === "test" ? false : { level: "info" },
    genReqId: (request) => request.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "Request validation failed.",
        issues: error.issues,
        requestId: request.id,
      });
    }

    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({
        error: error.code,
        message: error.message,
        requestId: request.id,
        ...(error.details ?? {}),
      });
    }

    return reply.code(500).send({
      error: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error.",
      requestId: request.id,
    });
  });

  await registerHealthRoutes(app);

  if (services.authSession) {
    await registerAuthRoutes(app, services.authSession);
  }

  if (services.payments) {
    await registerPaymentWebhookRoutes(app, config, services.payments);
  }

  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", createTenantMiddleware(config, tenantRepository));
    protectedApp.addHook("preHandler", createAuthMiddleware(services, tenantRepository));

    await registerMeRoutes(protectedApp);
    await registerOrganizationRoutes(protectedApp, services);

    if (services.subscriptions) {
      await registerSubscriptionRoutes(protectedApp, services.subscriptions, services);
    }
    if (services.batches) {
      await registerBatchRoutes(protectedApp, services.batches);
    }
    if (services.teachers) {
      await registerTeacherRoutes(protectedApp, services.teachers);
    }
    if (services.payments) {
      await registerPaymentRoutes(protectedApp, services.payments);
    }

    const extended = services as ExtendedAppServices;
    if (extended.audit) {
      const admin = createSupabaseAdmin(config);
      await registerAuditRoutes(protectedApp, extended.audit, services, admin);
    }

    await registerTestRoutes(protectedApp, services);
  });

  return app;
}
