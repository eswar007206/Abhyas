export type UserRole = "developer" | "organization_admin" | "student";
export type AccountType = "independent" | "organization";
export type SubscriptionStatus = "free" | "trialing" | "active" | "past_due" | "cancelled";
export type OptionKey = "A" | "B" | "C" | "D";
export type QuestionType = "mcq" | "numerical";

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  accountType: AccountType;
  organizationId: string | null;
  freeTestLimit: number;
  subscriptionStatus: SubscriptionStatus;
  state: string | null;
  city: string | null;
}

export interface Organization {
  id: string;
  name: string;
  contact_email: string | null;
  seat_limit: number;
  status: string;
}

export interface CreatedStudent {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
}

export interface CreatedAdmin {
  id: string;
  email: string;
  fullName: string;
}

export interface TestQuestion {
  id: string;
  questionText: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctOption: OptionKey | null;
  questionType: QuestionType;
  numericalAnswer: string | null;
  numericalTolerance: number;
  correctMarks: number;
  wrongMarks: number;
  subject: string;
  topicName: string;
}

export interface PublicTestQuestion {
  id: string;
  questionText: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  questionType: QuestionType;
  subject: string;
  topicName: string;
}

export interface TestSession {
  id: string;
  title: string;
  examId: string;
  durationMinutes: number;
  totalQuestions: number;
  questions: TestQuestion[];
}

export interface GradedAnswer {
  questionId: string;
  questionType: QuestionType;
  selectedAnswer: string | null;
  correctAnswer: string;
  selectedOption: OptionKey | null;
  correctOption: OptionKey | null;
  isCorrect: boolean;
  marksAwarded: number;
}

export interface CreateAttemptInput {
  idempotencyKey?: string;
  studentId: string;
  organizationId: string | null;
  testId: string;
  examId: string;
  score: number;
  maxScore: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  durationSeconds: number | null;
  answers: GradedAnswer[];
}

export interface RankingRow {
  attemptId: string;
  fullName: string;
  testTitle: string;
  score: number;
  maxScore: number;
  rank: number | null;
  rankDelta: number | null;
  previousRank: number | null;
  state: string | null;
  city: string | null;
  organizationName: string | null;
  submittedAt: string;
  averageScore: number | null;
  attemptCount: number | null;
}

export interface RankingSummary {
  publicRankings: {
    allIndiaRaw: RankingRow[];
    stateRaw: RankingRow[];
    cityRaw: RankingRow[];
    allIndiaAverage: RankingRow[];
    stateAverage: RankingRow[];
    cityAverage: RankingRow[];
  };
  organizationRankings: {
    raw: RankingRow[];
    average: RankingRow[];
  } | null;
  movement: {
    currentRank: number | null;
    previousRank: number | null;
    delta: number | null;
  } | null;
}
