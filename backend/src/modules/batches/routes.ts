import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middleware/authorize.js";
import { requireProfile } from "../../middleware/auth.js";
import { requireTenantOrganizationMatch } from "../tenant/middleware.js";
import type { BatchesService } from "./service.js";

const createBatchSchema = z.object({
  organizationId: z.string().uuid().or(z.string().min(1)),
  name: z.string().trim().min(1),
  examSlug: z.string().trim().min(1).optional(),
  teacherId: z.string().uuid().optional(),
  academicYear: z.string().trim().min(1).optional(),
});

export async function registerBatchRoutes(app: FastifyInstance, batchesService: BatchesService) {
  app.get("/api/me/batches", async (request) => {
    const profile = requireProfile(request);
    if (!profile.organizationId) return { batches: [] };
    requireTenantOrganizationMatch(request, profile.organizationId);
    const batches = await batchesService.listMyBatches(profile.id, profile.organizationId);
    return { batches };
  });

  app.get("/api/org/batches", async (request) => {
    requirePermission(request, "org.batches.manage");
    const profile = requireProfile(request);
    if (!profile.organizationId) return { batches: [] };
    requireTenantOrganizationMatch(request, profile.organizationId);
    const batches = await batchesService.listBatches(profile.organizationId);
    return { batches };
  });

  app.post("/api/org/batches", async (request, reply) => {
    requirePermission(request, "org.batches.manage");
    requireProfile(request);
    const payload = createBatchSchema.parse(request.body);
    requireTenantOrganizationMatch(request, payload.organizationId);

    const batch = await batchesService.createBatch({
      organizationId: payload.organizationId,
      name: payload.name,
      examSlug: payload.examSlug,
      teacherId: payload.teacherId,
      academicYear: payload.academicYear,
    });
    return reply.code(201).send({ batch });
  });

  app.post("/api/org/batches/:batchId/enrollments", async (request, reply) => {
    requirePermission(request, "org.batches.manage");
    const { batchId } = z.object({ batchId: z.string().min(1) }).parse(request.params);
    const { studentId } = z.object({ studentId: z.string().min(1) }).parse(request.body);
    await batchesService.enrollStudent(batchId, studentId);
    return reply.code(201).send({ ok: true });
  });

  app.get("/api/org/attendance", async (request) => {
    requirePermission(request, "org.batches.manage");
    const profile = requireProfile(request);
    if (!profile.organizationId) return { attendance: [] };
    requireTenantOrganizationMatch(request, profile.organizationId);
    const query = z
      .object({
        batchId: z.string().min(1),
        sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(request.query);
    const attendance = await batchesService.listAttendance(
      profile.organizationId,
      query.batchId,
      query.sessionDate,
    );
    return { attendance };
  });

  app.post("/api/org/attendance", async (request, reply) => {
    requirePermission(request, "org.batches.manage");
    const profile = requireProfile(request);
    if (!profile.organizationId) {
      return reply
        .code(400)
        .send({ error: "NO_ORGANIZATION", message: "No organization on profile." });
    }
    requireTenantOrganizationMatch(request, profile.organizationId);
    const payload = z
      .object({
        batchId: z.string().min(1),
        studentId: z.string().min(1),
        sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(["present", "absent", "late"]),
        notes: z.string().trim().optional(),
      })
      .parse(request.body);
    const record = await batchesService.markAttendance({
      organizationId: profile.organizationId,
      batchId: payload.batchId,
      studentId: payload.studentId,
      sessionDate: payload.sessionDate,
      status: payload.status,
      markedBy: profile.id,
      notes: payload.notes,
    });
    return reply.code(201).send({ attendance: record });
  });
}
