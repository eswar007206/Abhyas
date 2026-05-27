import type { AuthService, ProfileService } from "../organization/types.js";
import type { TeachersRepository } from "./repository.js";
import type { CreateTeacherInput, TeacherProfile } from "./types.js";

export class TeachersService {
  constructor(
    private readonly repository: TeachersRepository,
    private readonly auth: AuthService,
    private readonly profile: ProfileService,
  ) {}

  async createTeacher(input: CreateTeacherInput): Promise<TeacherProfile> {
    const created = await this.auth.createUser({
      email: input.email,
      password: input.password,
      fullName: input.fullName,
    });

    await this.profile.upsertProfile({
      id: created.id,
      email: created.email,
      fullName: created.fullName,
      role: "student",
      accountType: "organization",
      organizationId: input.organizationId,
      freeTestLimit: 999,
      subscriptionStatus: "active",
      state: null,
      city: null,
      authEmail: created.email,
    });

    await this.repository.upsertTeacherMembership(input.organizationId, created.id);

    return this.repository.upsertTeacherProfile({
      userId: created.id,
      organizationId: input.organizationId,
      subjects: input.subjects ?? [],
      bio: input.bio ?? null,
    });
  }

  listTeachers(organizationId: string) {
    return this.repository.listByOrganization(organizationId);
  }
}
