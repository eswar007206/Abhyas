import type {
  AuthUser,
  CreateAttemptInput,
  CreatedStudent,
  Organization,
  Profile,
  RankingSummary,
  TestSession,
} from "../types/domain.js";

export interface AppServices {
  auth: {
    getUserFromToken(token: string): Promise<AuthUser | null>;
    createUser(input: {
      email: string;
      password: string;
      fullName: string;
      role?: string;
    }): Promise<{
      id: string;
      email: string;
      fullName: string;
    }>;
    resetPassword(userId: string, password: string): Promise<void>;
  };
  profile: {
    getProfileById(id: string): Promise<Profile | null>;
    upsertProfile(profile: Profile): Promise<Profile>;
  };
  organization: {
    createOrganizationWithAdmin(input: {
      name: string;
      contactEmail: string;
      seatLimit: number;
      adminFullName: string;
      adminEmail: string;
      adminPassword: string;
    }): Promise<{
      organization: Organization;
      admin: { id: string; email: string; fullName: string };
    }>;
    getOrganization(id: string): Promise<Organization | null>;
    getUsedSeats(organizationId: string): Promise<number>;
    isOrganizationAdmin(userId: string, organizationId: string): Promise<boolean>;
    createStudent(input: {
      organizationId: string;
      fullName: string;
      email: string;
      password: string;
    }): Promise<CreatedStudent>;
    getStudentProfile(studentId: string): Promise<Profile | null>;
  };
  test: {
    getSession(testId: string): Promise<TestSession | null>;
    getUsedAttemptCount(studentId: string): Promise<number>;
    hasActiveSubscription(studentId: string): Promise<boolean>;
    createAttempt(input: CreateAttemptInput): Promise<{ id: string } & CreateAttemptInput>;
    refreshLeaderboards(attemptId: string): Promise<void>;
  };
  ranking: {
    getSummary(input: { examSlug: string; profile: Profile }): Promise<RankingSummary>;
  };
}
