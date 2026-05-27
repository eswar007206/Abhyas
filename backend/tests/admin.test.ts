import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createMockServices } from "./mocks.js";

describe("admin routes", () => {
  it("allows developers to create organizations", async () => {
    const services = createMockServices();
    const app = await buildApp({ services });

    const response = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { authorization: "Bearer valid-developer" },
      payload: {
        name: "Scale Academy",
        contactEmail: "admin@scale.test",
        seatLimit: 450,
        adminFullName: "Org Admin",
        adminEmail: "org.admin@scale.test",
        adminPassword: "Password123!",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      organization: { name: "Scale Academy", seat_limit: 450 },
      admin: { email: "org.admin@scale.test" },
    });
    await app.close();
  });

  it("rejects organization creation by non-developers", async () => {
    const app = await buildApp({ services: createMockServices() });

    const response = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { authorization: "Bearer valid-admin" },
      payload: {
        name: "Blocked Academy",
        contactEmail: "admin@blocked.test",
        seatLimit: 450,
        adminFullName: "Org Admin",
        adminEmail: "org.admin@blocked.test",
        adminPassword: "Password123!",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "FORBIDDEN" });
    await app.close();
  });

  it("enforces organization seat limits when creating students", async () => {
    const services = createMockServices({ usedSeats: 450, seatLimit: 450 });
    const app = await buildApp({ services });

    const response = await app.inject({
      method: "POST",
      url: "/api/org/students",
      headers: { authorization: "Bearer valid-admin" },
      payload: {
        organizationId: "org-1",
        fullName: "Student",
        email: "student@scale.test",
        password: "Password123!",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: "SEAT_LIMIT_REACHED",
      usedSeats: 450,
      seatLimit: 450,
      remainingSeats: 0,
    });
    await app.close();
  });

  it("allows organization admins to create students inside their organization", async () => {
    const services = createMockServices({ usedSeats: 10, seatLimit: 450 });
    const app = await buildApp({ services });

    const response = await app.inject({
      method: "POST",
      url: "/api/org/students",
      headers: { authorization: "Bearer valid-admin" },
      payload: {
        organizationId: "org-1",
        fullName: "Student",
        email: "student@scale.test",
        password: "Password123!",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      student: { email: "student@scale.test", organizationId: "org-1" },
    });
    await app.close();
  });

  it("returns seat usage for organization admins", async () => {
    const services = createMockServices({ usedSeats: 12, seatLimit: 450 });
    const app = await buildApp({ services });

    const response = await app.inject({
      method: "GET",
      url: "/api/org/seats",
      headers: { authorization: "Bearer valid-admin" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      seats: { purchased: 450, used: 12, remaining: 438 },
    });
    await app.close();
  });

  it("prevents admins from resetting students outside their organization", async () => {
    const services = createMockServices({ studentOrganizationId: "other-org" });
    const app = await buildApp({ services });

    const response = await app.inject({
      method: "POST",
      url: "/api/org/students/student-1/reset-password",
      headers: { authorization: "Bearer valid-admin" },
      payload: { newPassword: "NewPassword123!" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "FORBIDDEN" });
    await app.close();
  });
});
