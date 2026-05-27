import type { FastifyInstance } from "fastify";
import { requireProfile } from "../middleware/auth.js";

export async function registerMeRoutes(app: FastifyInstance) {
  app.get("/api/me", async (request) => ({
    profile: requireProfile(request),
  }));
}
