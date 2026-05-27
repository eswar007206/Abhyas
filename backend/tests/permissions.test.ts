import { describe, expect, it, vi } from "vitest";
import { fallbackPermissionsForRoles } from "../src/modules/permissions/fallback-permissions.js";
import type { PermissionsRepository } from "../src/modules/permissions/repository.js";
import { PermissionsService } from "../src/modules/permissions/service.js";
import type { Profile } from "../src/types/domain.js";

describe("permissions fallback", () => {
  it("grants org admin permissions when role_permissions table is empty", () => {
    const permissions = fallbackPermissionsForRoles(["admin"]);
    expect(permissions.has("org.students.create")).toBe(true);
    expect(permissions.has("org.seats.view")).toBe(true);
  });

  it("grants super admin platform permissions", () => {
    const permissions = fallbackPermissionsForRoles(["super_admin"]);
    expect(permissions.has("platform.orgs.manage")).toBe(true);
  });

  it("merges database permissions with fallback when seed is partial", async () => {
    const repository = {
      listPlatformRoles: vi.fn(async () => []),
      findOrgMembershipRole: vi.fn(async () => null),
      listPermissionsForRoles: vi.fn(async () => ["org.seats.view"]),
    } as unknown as PermissionsRepository;
    const service = new PermissionsService(repository);

    const profile: Profile = {
      id: "admin-1",
      email: "admin@test",
      fullName: "Admin",
      role: "organization_admin",
      accountType: "organization",
      organizationId: "org-1",
      freeTestLimit: 999,
      subscriptionStatus: "active",
      state: null,
      city: null,
    };

    const context = await service.buildAuthorizationContext(profile);
    expect(context.permissions.has("org.seats.view")).toBe(true);
    expect(context.permissions.has("org.students.create")).toBe(true);
  });
});
