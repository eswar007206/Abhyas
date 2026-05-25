import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { createMockServices } from "./mocks.js";

describe("backend shell", () => {
  it("returns health status without authentication", async () => {
    const app = await buildApp({ services: createMockServices() });

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, service: "abhyas-backend" });
    await app.close();
  });

  it("rejects protected requests without a bearer token", async () => {
    const app = await buildApp({ services: createMockServices() });

    const response = await app.inject({ method: "GET", url: "/api/me" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "UNAUTHORIZED" });
    await app.close();
  });

  it("loads the current profile for authenticated requests", async () => {
    const services = createMockServices();
    const app = await buildApp({ services });

    const response = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer valid-student" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      profile: {
        id: "student-1",
        role: "student",
      },
    });
    expect(services.auth.getUserFromToken).toHaveBeenCalledWith("valid-student");
    await app.close();
  });

  it("returns normalized errors for unexpected failures", async () => {
    const services = createMockServices();
    services.profile.getProfileById = vi.fn().mockRejectedValue(new Error("database offline"));
    const app = await buildApp({ services });

    const response = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer valid-student" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: "INTERNAL_SERVER_ERROR" });
    await app.close();
  });
});
