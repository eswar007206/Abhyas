import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config/env.js";
import { createAppServices } from "./create-app-services.js";
import { AuthRepository } from "../modules/auth/repository.js";
import type { LoginAliasSupport } from "../modules/auth/types.js";
import { OrganizationRepository } from "../modules/organization/repository.js";
import { OrganizationService } from "../modules/organization/service.js";
import type { AppServices } from "./index.js";
import type {
  AuthUser,
  CreateAttemptInput,
  OptionKey,
  Profile,
  RankingRow,
  TestQuestion,
  TestSession,
} from "../types/domain.js";

function toProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    email: String(row.email),
    authEmail: row.auth_email ? String(row.auth_email) : null,
    fullName: String(row.full_name),
    role: row.role as Profile["role"],
    accountType: row.account_type as Profile["accountType"],
    organizationId: row.organization_id ? String(row.organization_id) : null,
    freeTestLimit: Number(row.free_test_limit),
    subscriptionStatus: row.subscription_status as Profile["subscriptionStatus"],
    state: row.state ? String(row.state) : null,
    city: row.city ? String(row.city) : null,
  };
}

function toQuestion(row: Record<string, unknown>): TestQuestion {
  const question = row.jee_questions as Record<string, unknown>;
  return {
    id: String(question.id),
    questionText: String(question.question_text),
    optionA: question.option_a ? String(question.option_a) : null,
    optionB: question.option_b ? String(question.option_b) : null,
    optionC: question.option_c ? String(question.option_c) : null,
    optionD: question.option_d ? String(question.option_d) : null,
    correctOption: question.correct_option ? (question.correct_option as OptionKey) : null,
    questionType: question.question_type === "numerical" ? "numerical" : "mcq",
    numericalAnswer: question.numerical_answer ? String(question.numerical_answer) : null,
    numericalTolerance: Number(question.numerical_tolerance ?? 0),
    correctMarks: Number(question.correct_marks ?? 4),
    wrongMarks: Number(question.wrong_marks ?? (question.question_type === "numerical" ? 0 : -1)),
    subject: String(question.subject),
    topicName: String(question.topic_name),
  };
}

function toRankingRow(row: Record<string, unknown>): RankingRow {
  return {
    attemptId: String(row.attempt_id),
    fullName: String(row.full_name),
    testTitle: String(row.test_title),
    score: Number(row.score),
    maxScore: Number(row.max_score),
    rank: row.rank === null || row.rank === undefined ? null : Number(row.rank),
    rankDelta:
      row.rank_delta === null || row.rank_delta === undefined ? null : Number(row.rank_delta),
    previousRank:
      row.previous_rank === null || row.previous_rank === undefined
        ? null
        : Number(row.previous_rank),
    state: row.state ? String(row.state) : null,
    city: row.city ? String(row.city) : null,
    organizationName: row.organization_name ? String(row.organization_name) : null,
    submittedAt: String(row.submitted_at),
    averageScore:
      row.average_score === null || row.average_score === undefined
        ? null
        : Number(row.average_score),
    attemptCount:
      row.attempt_count === null || row.attempt_count === undefined
        ? null
        : Number(row.attempt_count),
  };
}

export function createSupabaseServices(config: AppConfig): AppServices {
  return createAppServices(config);
}

export { createAppServices } from "./create-app-services.js";

export function createSupabaseServicesFromClient(supabase: SupabaseClient): AppServices {
  const organizationRepository = new OrganizationRepository(supabase);

  const auth: AppServices["auth"] = {
    async getUserFromToken(token: string): Promise<AuthUser | null> {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) return null;
      return { id: user.id, email: user.email ?? null };
    },
    async createUser({ email, password, fullName, role }) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: role ? { role } : undefined,
        user_metadata: { full_name: fullName },
      });
      if (error || !data.user) throw error ?? new Error("User creation failed.");
      return { id: data.user.id, email, fullName };
    },
    async resetPassword(userId: string, password: string) {
      const { error } = await supabase.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
    },
    async updateEmail(userId: string, email: string) {
      const { error } = await supabase.auth.admin.updateUserById(userId, { email });
      if (error) throw error;
    },
  };

  const profile: AppServices["profile"] = {
    async getProfileById(id: string) {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
      if (error || !data) return null;
      return toProfile(data);
    },
    async upsertProfile(profile: Profile) {
      const { data, error } = await supabase
        .from("profiles")
        .upsert({
          id: profile.id,
          email: profile.email,
          auth_email: profile.authEmail ?? profile.email,
          full_name: profile.fullName,
          role: profile.role,
          account_type: profile.accountType,
          organization_id: profile.organizationId,
          free_test_limit: profile.freeTestLimit,
          subscription_status: profile.subscriptionStatus,
          state: profile.state,
          city: profile.city,
        })
        .select("*")
        .single();
      if (error || !data) throw error ?? new Error("Profile upsert failed.");
      return toProfile(data);
    },
  };

  const organization = createOrganizationServiceFacade(
    supabase,
    { auth, profile } as Pick<AppServices, "auth" | "profile">,
    organizationRepository,
  );

  const services: AppServices = {
    auth,
    profile,
    organization,
    test: {
      async getSession(testId: string): Promise<TestSession | null> {
        const { data: test, error: testError } = await supabase
          .from("tests")
          .select("id, title, duration_minutes, total_questions, exam_id")
          .eq("id", testId)
          .eq("is_active", true)
          .single();
        if (testError || !test) return null;

        const { data: questions, error: questionsError } = await supabase
          .from("test_questions")
          .select(
            "position, jee_questions(id, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, numerical_answer, numerical_tolerance, correct_marks, wrong_marks, subject, topic_name)",
          )
          .eq("test_id", testId)
          .order("position");
        if (questionsError) throw questionsError;

        return {
          id: test.id,
          title: test.title,
          examId: test.exam_id,
          durationMinutes: test.duration_minutes,
          totalQuestions: test.total_questions,
          questions: (questions ?? []).map((row) => toQuestion(row as Record<string, unknown>)),
        };
      },
      async getUsedAttemptCount(studentId: string) {
        const { count, error } = await supabase
          .from("test_attempts")
          .select("id", { count: "exact", head: true })
          .eq("student_id", studentId);
        if (error) throw error;
        return count ?? 0;
      },
      async hasActiveSubscription(studentId: string) {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", studentId)
          .in("status", ["trialing", "active"])
          .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`)
          .maybeSingle();
        if (error) throw error;
        return Boolean(data);
      },
      async createAttempt(input: CreateAttemptInput) {
        const { data: existing } = input.idempotencyKey
          ? await supabase
              .from("test_attempts")
              .select("id")
              .eq("student_id", input.studentId)
              .eq("client_attempt_id", input.idempotencyKey)
              .maybeSingle()
          : { data: null };

        if (existing?.id) {
          return { id: existing.id, ...input };
        }

        const { data: attempt, error } = await supabase
          .from("test_attempts")
          .insert({
            client_attempt_id: input.idempotencyKey,
            student_id: input.studentId,
            organization_id: input.organizationId,
            test_id: input.testId,
            exam_id: input.examId,
            score: input.score,
            max_score: input.maxScore,
            correct_count: input.correctCount,
            wrong_count: input.wrongCount,
            unattempted_count: input.unattemptedCount,
            duration_seconds: input.durationSeconds,
          })
          .select("id")
          .single();
        if (error || !attempt) throw error ?? new Error("Attempt insert failed.");

        const { error: answersError } = await supabase.from("test_attempt_answers").insert(
          input.answers.map((answer, index) => ({
            attempt_id: attempt.id,
            question_id: answer.questionId,
            selected_option: answer.selectedOption,
            selected_answer: answer.selectedAnswer,
            correct_option: answer.correctOption,
            correct_answer: answer.correctAnswer,
            question_type: answer.questionType,
            is_correct: answer.isCorrect,
            marks_awarded: answer.marksAwarded,
            topic_name: answer.topicName,
            subject: answer.subject,
            position: index + 1,
          })),
        );
        if (answersError) throw answersError;

        return { id: attempt.id, ...input };
      },
      async refreshLeaderboards(attemptId: string) {
        const { error } = await supabase.rpc("refresh_leaderboards_for_attempt", {
          attempt_id_input: attemptId,
        });
        if (error) throw error;
      },
    },
    ranking: {
      async getSummary({ examSlug, profile, period = "all", batchId }) {
        const selectColumns =
          "attempt_id, full_name, test_title, score, max_score, rank, rank_delta, previous_rank, state, city, organization_name, submitted_at, average_score, attempt_count, student_id";

        let batchStudentIds: string[] | null = null;
        if (batchId) {
          const { data: enrollments, error: enrollmentError } = await supabase
            .from("batch_enrollments")
            .select("student_id")
            .eq("batch_id", batchId)
            .eq("status", "active");
          if (enrollmentError) throw enrollmentError;
          batchStudentIds = (enrollments ?? []).map((row) => String(row.student_id));
          if (batchStudentIds.length === 0) {
            return {
              publicRankings: {
                allIndiaRaw: [],
                stateRaw: [],
                cityRaw: [],
                allIndiaAverage: [],
                stateAverage: [],
                cityAverage: [],
              },
              organizationRankings: null,
              batchRankings: { raw: [], average: [] },
              movement: null,
            };
          }
        }

        const periodStart =
          period === "weekly"
            ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            : period === "monthly"
              ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
              : null;

        async function rows(scope: string, filters: Record<string, string | null>) {
          let query = supabase
            .from("ranking_entries")
            .select(selectColumns)
            .eq("exam_slug", examSlug)
            .eq("scope", scope)
            .order("rank", { ascending: true })
            .limit(20);

          for (const [key, value] of Object.entries(filters)) {
            if (value) query = query.eq(key, value);
          }
          if (periodStart) {
            query = query.gte("submitted_at", periodStart);
          }
          if (batchStudentIds) {
            query = query.in("student_id", batchStudentIds);
          }

          const { data, error } = await query;
          if (error) throw error;
          return (data ?? []).map((row) => toRankingRow(row as Record<string, unknown>));
        }

        const [
          allIndiaRaw,
          stateRaw,
          cityRaw,
          organizationRaw,
          allIndiaAverage,
          stateAverage,
          cityAverage,
          organizationAverage,
          movementRows,
        ] = await Promise.all([
          rows("all_india_raw", {}),
          profile.state ? rows("state_raw", { state: profile.state }) : Promise.resolve([]),
          profile.city ? rows("city_raw", { city: profile.city }) : Promise.resolve([]),
          profile.organizationId
            ? rows("organization_raw", { organization_id: profile.organizationId })
            : Promise.resolve([]),
          rows("all_india_average", {}),
          profile.state ? rows("state_average", { state: profile.state }) : Promise.resolve([]),
          profile.city ? rows("city_average", { city: profile.city }) : Promise.resolve([]),
          profile.organizationId
            ? rows("organization_average", { organization_id: profile.organizationId })
            : Promise.resolve([]),
          supabase
            .from("ranking_entries")
            .select(selectColumns)
            .eq("exam_slug", examSlug)
            .eq("scope", "all_india_raw")
            .eq("student_id", profile.id)
            .order("submitted_at", { ascending: false })
            .limit(1)
            .then(({ data, error }) => {
              if (error) throw error;
              let rows = data ?? [];
              if (periodStart) {
                rows = rows.filter((row) => String(row.submitted_at) >= periodStart);
              }
              return rows.map((row) => toRankingRow(row as Record<string, unknown>));
            }),
        ]);

        const movement = movementRows[0]
          ? {
              currentRank: movementRows[0].rank,
              previousRank: movementRows[0].previousRank,
              delta: movementRows[0].rankDelta,
            }
          : null;

        return {
          publicRankings: {
            allIndiaRaw,
            stateRaw,
            cityRaw,
            allIndiaAverage,
            stateAverage,
            cityAverage,
          },
          organizationRankings: profile.organizationId
            ? {
                raw: organizationRaw,
                average: organizationAverage,
              }
            : null,
          batchRankings: batchId
            ? {
                raw: organizationRaw.length > 0 ? organizationRaw : allIndiaRaw,
                average: organizationAverage.length > 0 ? organizationAverage : allIndiaAverage,
              }
            : null,
          movement,
        };
      },
    },
  };

  return services;
}

function createOrganizationServiceFacade(
  supabase: SupabaseClient,
  core: Pick<AppServices, "auth" | "profile">,
  organizationRepository: OrganizationRepository,
): AppServices["organization"] {
  const authRepository = new AuthRepository(supabase);
  const authSession: LoginAliasSupport = {
    buildInternalAuthEmail: (userId: string) => `${userId}@users.internal.abhyas`,
    buildAliasLoginEmail: (aliasLocal: string, subdomain: string) =>
      `${aliasLocal}@${subdomain}.abhyas.in`,
  };

  const organizationService = new OrganizationService(
    organizationRepository,
    core.auth,
    core.profile,
    authRepository,
    authSession,
    undefined,
  );

  return {
    createOrganizationWithAdmin: (input) => organizationService.createOrganizationWithAdmin(input),
    getOrganization: (id) => organizationService.getOrganization(id),
    isOrganizationAdmin: (userId, organizationId) =>
      organizationService.isOrganizationAdmin(userId, organizationId),
    createStudent: (input) => organizationService.createStudent(input),
    getStudentProfile: (studentId) => organizationService.getStudentProfile(studentId),
  };
}
