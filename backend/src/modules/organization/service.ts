import { conflict, notFound } from "../../http/errors.js";
import type { AuthRepository } from "../auth/repository.js";
import type { AuditRepository } from "../audit/repository.js";
import type { LoginAliasSupport } from "../auth/types.js";
import { assertSeatAvailable } from "../seat-management/service.js";
import type { SubscriptionsService } from "../subscriptions/service.js";
import type { OrganizationRepository } from "./repository.js";
import type { AuthService as OrgAuthService, ProfileService } from "./types.js";

export interface CreateOrganizationWithAdminInput {
  name: string;
  contactEmail: string;
  seatLimit: number;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  subdomain?: string | null;
  planSlug?: string | null;
}

export interface CreateOrganizationStudentInput {
  organizationId: string;
  fullName: string;
  email: string;
  password: string;
  aliasLocal?: string | null;
}

export class OrganizationService {
  constructor(
    private readonly repository: OrganizationRepository,
    private readonly auth: OrgAuthService,
    private readonly profile: ProfileService,
    private readonly authRepository: AuthRepository,
    private readonly authSession: LoginAliasSupport,
    private readonly subscriptions?: SubscriptionsService,
    private readonly audit?: AuditRepository,
  ) {}

  async createOrganizationWithAdmin(input: CreateOrganizationWithAdminInput) {
    const organization = await this.repository.insertOrganization({
      name: input.name,
      contactEmail: input.contactEmail,
      seatLimit: input.seatLimit,
      subdomain: input.subdomain,
      planSlug: input.planSlug,
    });

    const admin = await this.auth.createUser({
      email: input.adminEmail,
      password: input.adminPassword,
      fullName: input.adminFullName,
      role: "organization_admin",
    });

    await this.profile.upsertProfile({
      id: admin.id,
      email: admin.email,
      authEmail: admin.email,
      fullName: admin.fullName,
      role: "organization_admin",
      accountType: "organization",
      organizationId: organization.id,
      freeTestLimit: 999,
      subscriptionStatus: "active",
      state: null,
      city: null,
    });

    await this.repository.upsertAdminMembership(organization.id, admin.id);

    if (input.planSlug && this.subscriptions) {
      await this.subscriptions.provisionOrganizationTrial(organization, input.planSlug);
    }

    return { organization, admin };
  }

  async getOrganization(id: string) {
    const organization = await this.repository.findById(id);
    if (!organization) throw notFound("Organization not found.");
    return organization;
  }

  async createStudent(input: CreateOrganizationStudentInput) {
    const organization = await this.getOrganization(input.organizationId);
    assertSeatAvailable(organization);

    const aliasLocal = input.aliasLocal?.trim().toLowerCase();
    const useAlias = Boolean(aliasLocal && organization.subdomain);
    const displayEmail = useAlias
      ? this.authSession.buildAliasLoginEmail(aliasLocal!, organization.subdomain!)
      : input.email;

    const placeholderEmail = useAlias
      ? `${crypto.randomUUID()}@users.internal.abhyas`
      : input.email;

    const created = await this.auth.createUser({
      email: placeholderEmail,
      password: input.password,
      fullName: input.fullName,
    });

    const authEmail = useAlias ? this.authSession.buildInternalAuthEmail(created.id) : input.email;

    if (useAlias && placeholderEmail !== authEmail) {
      await this.auth.updateEmail(created.id, authEmail);
    }

    await this.profile.upsertProfile({
      id: created.id,
      email: displayEmail,
      authEmail,
      fullName: created.fullName,
      role: "student",
      accountType: "organization",
      organizationId: input.organizationId,
      freeTestLimit: 999,
      subscriptionStatus: "active",
      state: null,
      city: null,
    });

    if (useAlias && aliasLocal && organization.subdomain) {
      await this.authRepository.insertLoginAlias({
        userId: created.id,
        organizationId: input.organizationId,
        aliasLocal,
        loginEmail: displayEmail,
      });
    }

    await this.repository.upsertStudentMembership(input.organizationId, created.id);

    return {
      id: created.id,
      email: displayEmail,
      fullName: created.fullName,
      organizationId: input.organizationId,
    };
  }

  isOrganizationAdmin(userId: string, organizationId: string) {
    return this.repository.isOrganizationAdmin(userId, organizationId);
  }

  getStudentProfile(studentId: string) {
    return this.repository.findStudentProfile(studentId);
  }

  listOrganizations(input: { query?: string; status?: string; limit?: number }) {
    return this.repository.listOrganizations(input);
  }

  async suspendOrganization(id: string, actorId: string) {
    const organization = await this.getOrganization(id);
    if (organization.status === "suspended") {
      throw conflict("ORG_ALREADY_SUSPENDED", "Organization is already suspended.");
    }
    const updated = await this.repository.updateStatus(id, "suspended");
    await this.audit?.insert({
      actorId,
      organizationId: id,
      action: "organization.suspended",
      entityType: "organization",
      entityId: id,
    });
    return updated;
  }

  async restoreOrganization(id: string, actorId: string) {
    const organization = await this.getOrganization(id);
    if (organization.status === "active") {
      throw conflict("ORG_ALREADY_ACTIVE", "Organization is already active.");
    }
    const updated = await this.repository.updateStatus(id, "active");
    await this.audit?.insert({
      actorId,
      organizationId: id,
      action: "organization.restored",
      entityType: "organization",
      entityId: id,
    });
    return updated;
  }

  async upgradeSeats(id: string, seatLimit: number, actorId: string) {
    if (seatLimit < 1) {
      throw conflict("INVALID_SEAT_LIMIT", "Seat limit must be at least 1.");
    }
    const organization = await this.getOrganization(id);
    if (seatLimit < organization.active_students) {
      throw conflict(
        "SEAT_LIMIT_BELOW_USAGE",
        "Seat limit cannot be lower than active student count.",
      );
    }
    const updated = await this.repository.updateSeatLimit(id, seatLimit);
    await this.audit?.insert({
      actorId,
      organizationId: id,
      action: "organization.seats_upgraded",
      entityType: "organization",
      entityId: id,
      metadata: { previous: organization.seat_limit, next: seatLimit },
    });
    return updated;
  }

  updateFeatureFlags(id: string, featureFlags: Record<string, unknown>, actorId: string) {
    return this.repository.updateFeatureFlags(id, featureFlags).then(async (updated) => {
      await this.audit?.insert({
        actorId,
        organizationId: id,
        action: "organization.feature_flags_updated",
        entityType: "organization",
        entityId: id,
        metadata: { featureFlags },
      });
      return updated;
    });
  }

  async updateOrganizationSettings(
    organizationId: string,
    actorId: string,
    input: { name?: string; contactEmail?: string; branding?: Record<string, unknown> },
  ) {
    await this.getOrganization(organizationId);
    const updated = await this.repository.updateSettings(organizationId, input);
    await this.audit?.insert({
      actorId,
      organizationId,
      action: "organization.settings_updated",
      entityType: "organization",
      entityId: organizationId,
      metadata: input,
    });
    return updated;
  }

  async importStudents(
    organizationId: string,
    actorId: string,
    rows: Array<{
      fullName: string;
      email?: string;
      aliasLocal?: string;
      password?: string;
    }>,
  ) {
    const defaultPassword = `Abhyas@${crypto.randomUUID().slice(0, 8)}`;
    const created: Array<{ email: string; fullName: string }> = [];
    const failures: Array<{ row: number; reason: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row.fullName.trim()) {
        failures.push({ row: index + 1, reason: "Full name is required." });
        continue;
      }
      try {
        const student = await this.createStudent({
          organizationId,
          fullName: row.fullName.trim(),
          email: row.email?.trim() || `${row.aliasLocal?.trim() || "student"}@placeholder.local`,
          password: row.password?.trim() || defaultPassword,
          aliasLocal: row.aliasLocal?.trim() || undefined,
        });
        created.push({ email: student.email, fullName: student.fullName });
      } catch (err) {
        failures.push({
          row: index + 1,
          reason: err instanceof Error ? err.message : "Import failed.",
        });
      }
    }

    await this.audit?.insert({
      actorId,
      organizationId,
      action: "organization.students_imported",
      entityType: "organization",
      entityId: organizationId,
      metadata: { created: created.length, failed: failures.length },
    });

    return { created, failures };
  }

  listAuditLogs(organizationId: string, limit?: number) {
    return this.audit?.listForOrganization(organizationId, limit ?? 50) ?? Promise.resolve([]);
  }
}
