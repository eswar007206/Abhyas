import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { conflict, forbidden, notFound } from "../http/errors.js";
import { requireProfile, requireRole } from "../middleware/auth.js";
import type { AppServices } from "../services/index.js";

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1),
  contactEmail: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  seatLimit: z.number().int().positive(),
  adminFullName: z.string().trim().min(1),
  adminEmail: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  adminPassword: z.string().min(8),
});

const createStudentSchema = z.object({
  organizationId: z.string().uuid().or(z.string().min(1)),
  fullName: z.string().trim().min(1),
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export async function registerAdminRoutes(app: FastifyInstance, services: AppServices) {
  app.post("/api/organizations", async (request, reply) => {
    requireRole(request, ["developer"]);
    const payload = createOrganizationSchema.parse(request.body);
    const result = await services.organization.createOrganizationWithAdmin(payload);
    return reply.code(201).send(result);
  });

  app.post("/api/org/students", async (request, reply) => {
    const profile = requireProfile(request);
    const payload = createStudentSchema.parse(request.body);

    if (profile.role !== "developer") {
      const allowed =
        profile.role === "organization_admin" &&
        (await services.organization.isOrganizationAdmin(profile.id, payload.organizationId));
      if (!allowed) throw forbidden();
    }

    const organization = await services.organization.getOrganization(payload.organizationId);
    if (!organization) throw notFound("Organization not found.");

    const usedSeats = await services.organization.getUsedSeats(payload.organizationId);
    if (usedSeats >= organization.seat_limit) {
      throw conflict(
        "SEAT_LIMIT_EXCEEDED",
        "Seat limit exceeded. Contact sales to add more seats.",
        {
          usedSeats,
          seatLimit: organization.seat_limit,
        },
      );
    }

    const student = await services.organization.createStudent(payload);
    return reply.code(201).send({ student });
  });

  app.post("/api/org/students/:studentId/reset-password", async (request) => {
    const profile = requireProfile(request);
    const params = z.object({ studentId: z.string().min(1) }).parse(request.params);
    const payload = resetPasswordSchema.parse(request.body);

    const student = await services.organization.getStudentProfile(params.studentId);
    if (!student || student.role !== "student" || !student.organizationId) {
      throw notFound("Organization student not found.");
    }

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
