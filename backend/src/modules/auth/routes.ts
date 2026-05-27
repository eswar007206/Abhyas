import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthService } from "./service.js";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

export async function registerAuthRoutes(app: FastifyInstance, authService: AuthService) {
  app.post("/api/auth/login", async (request, reply) => {
    const payload = loginSchema.parse(request.body);
    const session = await authService.login(payload);
    return reply.send({ session });
  });
}
