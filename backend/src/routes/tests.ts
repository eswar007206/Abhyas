import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { notFound, paymentRequired } from "../http/errors.js";
import { requireProfile } from "../middleware/auth.js";
import type { AppServices } from "../services/index.js";
import type { GradedAnswer, OptionKey, PublicTestQuestion, TestQuestion } from "../types/domain.js";

const answerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().trim().nullable().optional(),
  selectedOption: z.enum(["A", "B", "C", "D"]).nullable().optional(),
});

const submitSchema = z.object({
  answers: z.array(answerSchema),
  durationSeconds: z.number().int().nonnegative().optional(),
});

const optionKeys = ["A", "B", "C", "D"] as const;

function hideCorrectOption(question: TestQuestion): PublicTestQuestion {
  return {
    id: question.id,
    questionText: question.questionText,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    questionType: question.questionType,
    subject: question.subject,
    topicName: question.topicName,
  };
}

function answerForSubmission(answer: {
  answer?: string | null;
  selectedOption?: OptionKey | null;
}) {
  return answer.answer ?? answer.selectedOption ?? null;
}

function isNumericalCorrect(
  selectedAnswer: string | null,
  correctAnswer: string,
  tolerance: number,
) {
  if (!selectedAnswer) return false;
  const selected = Number(selectedAnswer);
  const expected = Number(correctAnswer);
  if (Number.isFinite(selected) && Number.isFinite(expected)) {
    return Math.abs(selected - expected) <= tolerance;
  }
  return selectedAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}

function grade(
  questions: TestQuestion[],
  answers: Array<{ questionId: string; answer?: string | null; selectedOption?: OptionKey | null }>,
): {
  score: number;
  maxScore: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  answers: GradedAnswer[];
} {
  const submitted = new Map(
    answers.map((answer) => [answer.questionId, answerForSubmission(answer)]),
  );
  const gradedAnswers = questions.map((question) => {
    const selectedAnswer = submitted.get(question.id)?.trim() || null;
    const correctAnswer =
      question.questionType === "numerical"
        ? (question.numericalAnswer ?? "")
        : (question.correctOption ?? "");
    const normalizedOption = selectedAnswer?.toUpperCase();
    const selectedOption =
      question.questionType === "mcq" &&
      normalizedOption &&
      optionKeys.includes(normalizedOption as OptionKey)
        ? (normalizedOption as OptionKey)
        : null;
    const isCorrect =
      question.questionType === "numerical"
        ? isNumericalCorrect(selectedAnswer, correctAnswer, question.numericalTolerance)
        : selectedOption === question.correctOption;
    const marksAwarded = !selectedAnswer
      ? 0
      : isCorrect
        ? question.correctMarks
        : question.wrongMarks;
    return {
      questionId: question.id,
      questionType: question.questionType,
      selectedAnswer,
      correctAnswer,
      selectedOption,
      correctOption: question.correctOption,
      isCorrect,
      marksAwarded,
    };
  });

  const correctCount = gradedAnswers.filter((answer) => answer.isCorrect).length;
  const wrongCount = gradedAnswers.filter(
    (answer) => answer.selectedAnswer && !answer.isCorrect,
  ).length;
  const unattemptedCount = gradedAnswers.filter((answer) => !answer.selectedAnswer).length;
  const score = gradedAnswers.reduce((total, answer) => total + answer.marksAwarded, 0);

  return {
    score,
    maxScore: questions.reduce((total, question) => total + question.correctMarks, 0),
    correctCount,
    wrongCount,
    unattemptedCount,
    answers: gradedAnswers,
  };
}

function canSubmitMore(profile: { accountType: string; subscriptionStatus: string }) {
  return (
    profile.accountType === "organization" ||
    profile.subscriptionStatus === "active" ||
    profile.subscriptionStatus === "trialing"
  );
}

export async function registerTestRoutes(app: FastifyInstance, services: AppServices) {
  app.get("/api/tests/:testId/session", async (request) => {
    z.object({ testId: z.string().min(1) }).parse(request.params);
    const { testId } = request.params as { testId: string };
    const session = await services.test.getSession(testId);
    if (!session) throw notFound("Test not found.");

    return {
      test: {
        id: session.id,
        title: session.title,
        examId: session.examId,
        durationMinutes: session.durationMinutes,
        totalQuestions: session.totalQuestions,
      },
      questions: session.questions.map(hideCorrectOption),
    };
  });

  app.post("/api/tests/:testId/submit", async (request, reply) => {
    const profile = requireProfile(request);
    z.object({ testId: z.string().min(1) }).parse(request.params);
    const { testId } = request.params as { testId: string };
    const payload = submitSchema.parse(request.body);
    const session = await services.test.getSession(testId);
    if (!session) throw notFound("Test not found.");

    if (!canSubmitMore(profile)) {
      const [usedAttempts, hasActiveSubscription] = await Promise.all([
        services.test.getUsedAttemptCount(profile.id),
        services.test.hasActiveSubscription(profile.id),
      ]);

      if (!hasActiveSubscription && usedAttempts >= profile.freeTestLimit) {
        throw paymentRequired(
          "FREE_LIMIT_REACHED",
          "Free test limit reached. Subscribe to continue.",
          {
            usedAttempts,
            freeTestLimit: profile.freeTestLimit,
          },
        );
      }
    }

    const result = grade(session.questions, payload.answers);
    const attempt = await services.test.createAttempt({
      idempotencyKey: request.headers["idempotency-key"]?.toString(),
      studentId: profile.id,
      organizationId: profile.organizationId,
      testId: session.id,
      examId: session.examId,
      score: result.score,
      maxScore: result.maxScore,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      unattemptedCount: result.unattemptedCount,
      durationSeconds: payload.durationSeconds ?? null,
      answers: result.answers,
    });

    await services.test.refreshLeaderboards(attempt.id);

    return reply.code(201).send({
      attempt: {
        id: attempt.id,
        score: attempt.score,
        maxScore: attempt.maxScore,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        unattemptedCount: attempt.unattemptedCount,
      },
    });
  });

  app.get("/api/rankings/:examSlug", async (request) => {
    const profile = requireProfile(request);
    const { examSlug } = z.object({ examSlug: z.string().min(1) }).parse(request.params);
    return services.ranking.getSummary({ examSlug, profile });
  });
}
