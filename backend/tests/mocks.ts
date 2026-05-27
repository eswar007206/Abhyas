import { vi } from "vitest";
import { conflict } from "../src/http/errors.js";
import { getSeatUsage } from "../src/modules/seat-management/service.js";
import type { PermissionsService } from "../src/modules/permissions/service.js";
import type { SubscriptionsService } from "../src/modules/subscriptions/service.js";
import type { AppServices } from "../src/services/index.js";
import type { Profile, TestQuestion, TestSession } from "../src/types/domain.js";

function createMockPermissions(): PermissionsService {
  const all = new Set([
    "platform.orgs.manage",
    "org.students.create",
    "org.students.manage",
    "org.seats.view",
    "org.batches.manage",
    "org.teachers.manage",
    "org.billing.manage",
  ]);
  return {
    buildAuthorizationContext: vi.fn(async (profile) => ({
      userId: profile.id,
      platformRoles: profile.role === "developer" ? (["super_admin"] as const) : [],
      orgRole: profile.role === "organization_admin" ? ("admin" as const) : null,
      organizationId: profile.organizationId,
      permissions: all,
    })),
    hasPermission: vi.fn((_ctx, code) => all.has(code)),
  } as unknown as PermissionsService;
}

interface MockOptions {
  usedSeats?: number;
  seatLimit?: number;
  usedAttempts?: number;
  freeTestLimit?: number;
  studentOrganizationId?: string | null;
  includeNumericalQuestion?: boolean;
}

const developer: Profile = {
  id: "developer-1",
  email: "dev@abhyas.test",
  fullName: "Developer",
  role: "developer",
  accountType: "independent",
  organizationId: null,
  freeTestLimit: 999,
  subscriptionStatus: "active",
  state: null,
  city: null,
};

const admin: Profile = {
  id: "admin-1",
  email: "admin@abhyas.test",
  fullName: "Admin",
  role: "organization_admin",
  accountType: "organization",
  organizationId: "org-1",
  freeTestLimit: 999,
  subscriptionStatus: "active",
  state: "Karnataka",
  city: "Bangalore",
};

function student(options: MockOptions): Profile {
  return {
    id: "student-1",
    email: "student@abhyas.test",
    fullName: "Student",
    role: "student",
    accountType: options.studentOrganizationId === undefined ? "independent" : "organization",
    organizationId: options.studentOrganizationId ?? null,
    freeTestLimit: options.freeTestLimit ?? 5,
    subscriptionStatus: "free",
    state: "Karnataka",
    city: "Bangalore",
  };
}

const testQuestions: TestQuestion[] = [
  {
    id: "q-1",
    questionText: "Question 1",
    optionA: "A",
    optionB: "B",
    optionC: "C",
    optionD: "D",
    correctOption: "A",
    questionType: "mcq",
    numericalAnswer: null,
    numericalTolerance: 0,
    correctMarks: 4,
    wrongMarks: -1,
    subject: "Physics",
    topicName: "Motion",
  },
  {
    id: "q-2",
    questionText: "Question 2",
    optionA: "A",
    optionB: "B",
    optionC: "C",
    optionD: "D",
    correctOption: "B",
    questionType: "mcq",
    numericalAnswer: null,
    numericalTolerance: 0,
    correctMarks: 4,
    wrongMarks: -1,
    subject: "Math",
    topicName: "Algebra",
  },
];

export function createMockServices(options: MockOptions = {}): AppServices {
  const questions = options.includeNumericalQuestion
    ? [
        ...testQuestions,
        {
          id: "q-3",
          questionText: "Find 20 / 4",
          optionA: "",
          optionB: "",
          optionC: "",
          optionD: "",
          correctOption: null,
          questionType: "numerical" as const,
          numericalAnswer: "5",
          numericalTolerance: 0,
          correctMarks: 4,
          wrongMarks: 0,
          subject: "Physics",
          topicName: "Speed",
        },
        {
          id: "q-4",
          questionText: "Find 5 + 5",
          optionA: "",
          optionB: "",
          optionC: "",
          optionD: "",
          correctOption: null,
          questionType: "numerical" as const,
          numericalAnswer: "10",
          numericalTolerance: 0,
          correctMarks: 4,
          wrongMarks: 0,
          subject: "Math",
          topicName: "Arithmetic",
        },
      ]
    : testQuestions;
  const testSession: TestSession = {
    id: "test-1",
    title: "Starter Test",
    examId: "exam-1",
    durationMinutes: 60,
    totalQuestions: questions.length,
    questions,
  };
  const profiles = new Map<string, Profile>([
    [developer.id, developer],
    [admin.id, admin],
    ["student-1", student(options)],
  ]);

  return {
    auth: {
      getUserFromToken: vi.fn(async (token: string) => {
        if (token === "valid-developer") return { id: developer.id, email: developer.email };
        if (token === "valid-admin") return { id: admin.id, email: admin.email };
        if (token === "valid-student") return { id: "student-1", email: "student@abhyas.test" };
        return null;
      }),
      createUser: vi.fn(async ({ email, fullName }) => ({
        id: `user-${email}`,
        email,
        fullName,
      })),
      resetPassword: vi.fn(async () => undefined),
      updateEmail: vi.fn(async () => undefined),
    },
    profile: {
      getProfileById: vi.fn(async (id: string) => profiles.get(id) ?? null),
      upsertProfile: vi.fn(async (profile: Profile) => profile),
    },
    organization: {
      createOrganizationWithAdmin: vi.fn(async (input) => ({
        organization: {
          id: "org-created",
          name: input.name,
          contact_email: input.contactEmail,
          seat_limit: input.seatLimit,
          status: "active",
          subdomain: input.subdomain ?? null,
          plan_slug: input.planSlug ?? null,
          active_students: 0,
          branding: {},
          feature_flags: {},
        },
        admin: {
          id: "admin-created",
          email: input.adminEmail,
          fullName: input.adminFullName,
        },
      })),
      getOrganization: vi.fn(async (id: string) => ({
        id,
        name: "Demo Org",
        contact_email: "admin@demo.test",
        seat_limit: options.seatLimit ?? 450,
        status: "active",
        subdomain: null,
        plan_slug: null,
        active_students: options.usedSeats ?? 0,
        branding: {},
        feature_flags: {},
      })),
      isOrganizationAdmin: vi.fn(async (userId: string, organizationId: string) => {
        return userId === admin.id && organizationId === admin.organizationId;
      }),
      createStudent: vi.fn(async (input) => {
        const seatLimit = options.seatLimit ?? 450;
        const used = options.usedSeats ?? 0;
        if (used >= seatLimit) {
          throw conflict("SEAT_LIMIT_REACHED", "Seat limit reached. Upgrade plan.", {
            usedSeats: used,
            seatLimit,
            remainingSeats: 0,
          });
        }
        return {
          id: `student-${input.email}`,
          email: input.email,
          fullName: input.fullName,
          organizationId: input.organizationId,
        };
      }),
      getStudentProfile: vi.fn(async (studentId: string) => ({
        ...student(options),
        id: studentId,
      })),
    },
    test: {
      getSession: vi.fn(async () => testSession),
      getUsedAttemptCount: vi.fn(async () => options.usedAttempts ?? 0),
      hasActiveSubscription: vi.fn(async () => false),
      createAttempt: vi.fn(async (input) => ({
        id: "attempt-created",
        ...input,
      })),
      refreshLeaderboards: vi.fn(async () => undefined),
    },
    permissions: createMockPermissions(),
    subscriptions: {
      getSeatUsageForOrganization: vi.fn((organization) => getSeatUsage(organization)),
      provisionOrganizationTrial: vi.fn(async () => ({})),
    } as unknown as SubscriptionsService,
    ranking: {
      getSummary: vi.fn(async ({ profile }) => {
        const averageRows = [
          {
            attemptId: "attempt-average-1",
            fullName: "Student",
            testTitle: "26 completed tests",
            score: 230,
            maxScore: 300,
            rank: 42,
            rankDelta: null,
            previousRank: null,
            state: profile.state,
            city: profile.city,
            organizationName: null,
            submittedAt: "2026-05-24T00:00:00Z",
            averageScore: 230,
            attemptCount: 26,
          },
        ];
        return {
          publicRankings: {
            allIndiaRaw: [
              {
                attemptId: "attempt-1",
                fullName: "Student",
                testTitle: "JEE Main Mock",
                score: 230,
                maxScore: 300,
                rank: 8941,
                rankDelta: 3541,
                previousRank: 12482,
                state: profile.state,
                city: profile.city,
                organizationName: null,
                submittedAt: "2026-05-24T00:00:00Z",
                averageScore: null,
                attemptCount: null,
              },
            ],
            stateRaw: [],
            cityRaw: [],
            allIndiaAverage: averageRows,
            stateAverage: averageRows,
            cityAverage: averageRows,
          },
          organizationRankings: profile.organizationId
            ? {
                raw: [],
                average: averageRows,
              }
            : null,
          movement: {
            currentRank: 8941,
            previousRank: 12482,
            delta: 3541,
          },
        };
      }),
    },
  };
}
