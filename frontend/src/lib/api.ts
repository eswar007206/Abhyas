import { supabase } from "@/lib/supabase";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

interface ApiErrorBody {
  error?: string;
  message?: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Please sign in again.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;

  if (!response.ok) {
    throw new Error(body.message ?? body.error ?? "Request failed.");
  }

  return body as T;
}

export interface CreateOrganizationInput {
  name: string;
  contactEmail: string;
  seatLimit: number;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface CreateStudentInput {
  organizationId: string;
  fullName: string;
  email: string;
  password: string;
}

export interface TestSessionQuestion {
  id: string;
  questionText: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  questionType: "mcq" | "numerical";
  subject: string;
  topicName: string;
}

export interface TestSessionResponse {
  test: {
    id: string;
    title: string;
    examId: string;
    durationMinutes: number;
    totalQuestions: number;
  };
  questions: TestSessionQuestion[];
}

export interface SubmitTestResponse {
  attempt: {
    id: string;
    score: number;
    maxScore: number;
    correctCount: number;
    wrongCount: number;
    unattemptedCount: number;
  };
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

export const api = {
  createOrganization(input: CreateOrganizationInput) {
    return request<{
      organization: { name: string; seat_limit: number };
      admin: { email: string };
    }>("/api/organizations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  createStudent(input: CreateStudentInput) {
    return request<{
      student: { id: string; email: string; fullName: string; organizationId: string };
    }>("/api/org/students", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  resetStudentPassword(studentId: string, newPassword: string) {
    return request<{ ok: true }>(`/api/org/students/${studentId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    });
  },
  getTestSession(testId: string) {
    return request<TestSessionResponse>(`/api/tests/${testId}/session`);
  },
  submitTest(
    testId: string,
    input: {
      answers: Array<{ questionId: string; answer: string | null }>;
      durationSeconds: number;
    },
  ) {
    const idempotencyKey = crypto.randomUUID();
    return request<SubmitTestResponse>(`/api/tests/${testId}/submit`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });
  },
  getRankings(examSlug: string) {
    return request<RankingSummary>(`/api/rankings/${examSlug}`);
  },
};
