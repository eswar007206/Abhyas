import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middleware/authorize.js";
import { requireTenantOrganizationMatch } from "../tenant/middleware.js";
import type { TeachersService } from "./service.js";

const createTeacherSchema = z.object({
  organizationId: z.string().uuid().or(z.string().min(1)),
  fullName: z.string().trim().min(1),
  email: z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8),
  subjects: z.array(z.string().trim().min(1)).optional(),
  bio: z.string().trim().optional(),
});

export async function registerTeacherRoutes(
  app: FastifyInstance,
  teachersService: TeachersService,
) {
  app.get("/api/org/teachers", async (request) => {
    requirePermission(request, "org.teachers.manage");
    const organizationId = z
      .object({ organizationId: z.string().min(1) })
      .parse(request.query).organizationId;
    requireTenantOrganizationMatch(request, organizationId);
    const teachers = await teachersService.listTeachers(organizationId);
    return { teachers };
  });

  app.post("/api/org/teachers", async (request, reply) => {
    requirePermission(request, "org.teachers.manage");
    const payload = createTeacherSchema.parse(request.body);
    requireTenantOrganizationMatch(request, payload.organizationId);
    const teacher = await teachersService.createTeacher(payload);
    return reply.code(201).send({ teacher });
  });
}
