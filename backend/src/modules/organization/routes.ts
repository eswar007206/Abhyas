import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { forbidden, notFound } from "../../http/errors.js";
import { requireAnyPermission, requirePermission } from "../../middleware/authorize.js";
import { requireProfile, requireRole } from "../../middleware/auth.js";
import type { AppServices } from "../../services/index.js";
import { requireTenantOrganizationMatch } from "../tenant/middleware.js";

const subdomainSchema = z
  .string()
  .trim()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Invalid subdomain format.")
  .optional();

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1),
  contactEmail: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  seatLimit: z.number().int().positive(),
  subdomain: subdomainSchema,
  planSlug: z.string().trim().min(1).optional(),
  adminFullName: z.string().trim().min(1),
  adminEmail: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  adminPassword: z.string().min(8),
});

const createStudentSchema = z
  .object({
    organizationId: z.string().uuid().or(z.string().min(1)),
    fullName: z.string().trim().min(1),
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase())
      .optional()
      .or(z.literal("")),
    password: z.string().min(8),
    aliasLocal: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[-a-z0-9._]+$/)
      .optional(),
  })
  .superRefine((data, ctx) => {
    const alias = data.aliasLocal?.trim();
    const email = data.email?.trim();
    if (!alias && !email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required when no login alias is provided.",
        path: ["email"],
      });
    }
  })
  .transform((data) => ({
    ...data,
    email: data.email?.trim() || `student-${crypto.randomUUID()}@placeholder.local`,
    aliasLocal: data.aliasLocal?.trim() || undefined,
  }));

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

const listOrganizationsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["active", "suspended"]).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

const seatUpgradeSchema = z.object({
  seatLimit: z.number().int().positive(),
});

const featureFlagsSchema = z.object({
  featureFlags: z.record(z.unknown()),
});

export async function registerOrganizationRoutes(app: FastifyInstance, services: AppServices) {
  app.get("/api/organizations", async (request) => {
    requireAnyPermission(request, ["platform.orgs.manage"]);
    requireRole(request, ["developer"]);
    const query = listOrganizationsQuerySchema.parse(request.query);
    const organizations = await services.organizationService!.listOrganizations({
      query: query.q,
      status: query.status,
      limit: query.limit,
    });
    return { organizations };
  });

  app.get("/api/organizations/:organizationId", async (request) => {
    requireAnyPermission(request, ["platform.orgs.manage"]);
    requireRole(request, ["developer"]);
    const { organizationId } = z
      .object({ organizationId: z.string().min(1) })
      .parse(request.params);
    const organization = await services.organization.getOrganization(organizationId);
    return { organization };
  });

  app.post("/api/organizations/:organizationId/suspend", async (request) => {
    const profile = requireProfile(request);
    requireAnyPermission(request, ["platform.orgs.manage"]);
    requireRole(request, ["developer"]);
    const { organizationId } = z
      .object({ organizationId: z.string().min(1) })
      .parse(request.params);
    const organization = await services.organizationService!.suspendOrganization(
      organizationId,
      profile.id,
    );
    return { organization };
  });

  app.post("/api/organizations/:organizationId/restore", async (request) => {
    const profile = requireProfile(request);
    requireAnyPermission(request, ["platform.orgs.manage"]);
    requireRole(request, ["developer"]);
    const { organizationId } = z
      .object({ organizationId: z.string().min(1) })
      .parse(request.params);
    const organization = await services.organizationService!.restoreOrganization(
      organizationId,
      profile.id,
    );
    return { organization };
  });

  app.patch("/api/organizations/:organizationId/seats", async (request) => {
    const profile = requireProfile(request);
    requireAnyPermission(request, ["platform.orgs.manage"]);
    requireRole(request, ["developer"]);
    const { organizationId } = z
      .object({ organizationId: z.string().min(1) })
      .parse(request.params);
    const payload = seatUpgradeSchema.parse(request.body);
    const organization = await services.organizationService!.upgradeSeats(
      organizationId,
      payload.seatLimit,
      profile.id,
    );
    return { organization };
  });

  app.patch("/api/organizations/:organizationId/feature-flags", async (request) => {
    const profile = requireProfile(request);
    requireAnyPermission(request, ["platform.orgs.manage"]);
    requireRole(request, ["developer"]);
    const { organizationId } = z
      .object({ organizationId: z.string().min(1) })
      .parse(request.params);
    const payload = featureFlagsSchema.parse(request.body);
    const organization = await services.organizationService!.updateFeatureFlags(
      organizationId,
      payload.featureFlags,
      profile.id,
    );
    return { organization };
  });

  app.patch("/api/org/settings", async (request) => {
    const profile = requireProfile(request);
    requirePermission(request, "org.settings.manage");
    if (!profile.organizationId) {
      return { organization: null };
    }
    requireTenantOrganizationMatch(request, profile.organizationId);
    const payload = z
      .object({
        name: z.string().trim().min(1).optional(),
        contactEmail: z.string().trim().email().optional(),
        branding: z.record(z.unknown()).optional(),
      })
      .parse(request.body);
    const organization = await services.organizationService!.updateOrganizationSettings(
      profile.organizationId,
      profile.id,
      payload,
    );
    return { organization };
  });

  const importStudentsSchema = z.object({
    organizationId: z.string().uuid().or(z.string().min(1)),
    rows: z
      .array(
        z.object({
          fullName: z.string().trim().min(1),
          email: z.string().trim().email().optional(),
          aliasLocal: z
            .string()
            .trim()
            .min(2)
            .max(64)
            .regex(/^[-a-z0-9._]+$/)
            .optional(),
          password: z.string().min(8).optional(),
        }),
      )
      .min(1)
      .max(500),
  });

  app.post("/api/org/students/import", async (request, reply) => {
    const profile = requireProfile(request);
    requirePermission(request, "org.students.create");
    const payload = importStudentsSchema.parse(request.body);
    requireTenantOrganizationMatch(request, payload.organizationId);

    if (profile.role !== "developer") {
      const allowed =
        profile.role === "organization_admin" &&
        (await services.organization.isOrganizationAdmin(profile.id, payload.organizationId));
      if (!allowed) throw forbidden();
    }

    const result = await services.organizationService!.importStudents(
      payload.organizationId,
      profile.id,
      payload.rows,
    );
    return reply.code(201).send(result);
  });

  app.post("/api/organizations", async (request, reply) => {
    requireAnyPermission(request, ["platform.orgs.manage"]);
    requireRole(request, ["developer"]);
    const payload = createOrganizationSchema.parse(request.body);
    const result = await services.organization.createOrganizationWithAdmin(payload);
    return reply.code(201).send(result);
  });

  app.post("/api/org/students", async (request, reply) => {
    const profile = requireProfile(request);
    const payload = createStudentSchema.parse(request.body);
    requireTenantOrganizationMatch(request, payload.organizationId);
    requirePermission(request, "org.students.create");

    if (profile.role !== "developer") {
      const allowed =
        profile.role === "organization_admin" &&
        (await services.organization.isOrganizationAdmin(profile.id, payload.organizationId));
      if (!allowed) throw forbidden();
    }

    const student = await services.organization.createStudent(payload);
    return reply.code(201).send({ student });
  });

  app.post("/api/org/students/:studentId/reset-password", async (request) => {
    const profile = requireProfile(request);
    requirePermission(request, "org.students.manage");
    const params = z.object({ studentId: z.string().min(1) }).parse(request.params);
    const payload = resetPasswordSchema.parse(request.body);

    const student = await services.organization.getStudentProfile(params.studentId);
    if (!student || student.role !== "student" || !student.organizationId) {
      throw notFound("Organization student not found.");
    }

    requireTenantOrganizationMatch(request, student.organizationId);

    if (profile.role !== "developer") {
      const allowed =
        profile.role === "organization_admin" &&
        (await services.organization.isOrganizationAdmin(profile.id, student.organizationId));
      if (!allowed) throw forbidden();
    }

    await services.auth.resetPassword(params.studentId, payload.newPassword);
    return { ok: true };
  });
}
