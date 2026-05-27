import { getApiUrl, isBackendApiEnabled } from "@/lib/api-config";
import { supabase } from "@/lib/supabase";

export { isBackendApiEnabled };

interface ApiErrorBody {
  error?: string;
  message?: string;
  usedAttempts?: number;
  freeTestLimit?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new ApiError("Backend API is not configured. Set VITE_API_URL in your environment.");
  }

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (!path.startsWith("/api/auth/login")) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new ApiError("Please sign in again.", "UNAUTHORIZED", 401);
    }
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;

  if (!response.ok) {
    throw new ApiError(
      body.message ?? body.error ?? "Request failed.",
      body.error,
      response.status,
      body as Record<string, unknown>,
    );
  }

  return body as T;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  contact_email: string | null;
  seat_limit: number;
  status: string;
  subdomain: string | null;
  plan_slug: string | null;
  active_students: number;
  branding: Record<string, unknown>;
  feature_flags: Record<string, unknown>;
}

export interface PlanRecord {
  id: string;
  slug: string;
  name: string;
  audience: "student" | "organization";
  price_monthly_inr: number;
  seat_limit: number | null;
}

export interface PaymentRecord {
  id: string;
  amount_paise: number;
  currency: string;
  status: string;
  razorpay_order_id: string | null;
  created_at: string;
}

export interface BatchRecord {
  id: string;
  name: string;
  exam_slug: string | null;
  academic_year: string | null;
  status: string;
}

export interface TeacherRecord {
  id: string;
  user_id: string;
  organization_id: string;
  subjects: string[];
  bio: string | null;
}

export interface AuditLogRecord {
  id: string;
  actor_id: string | null;
  organization_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateOrganizationInput {
  name: string;
  contactEmail: string;
  seatLimit: number;
  subdomain?: string;
  planSlug?: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface CreateStudentInput {
  organizationId: string;
  fullName: string;
  email: string;
  password: string;
  aliasLocal?: string;
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
  batchRankings?: {
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
  login(email: string, password: string) {
    return request<{
      session: {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        tokenType: string;
        user: { id: string; email: string | null };
      };
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  listOrganizations(params?: { q?: string; status?: "active" | "suspended" }) {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.status) search.set("status", params.status);
    const qs = search.toString();
    return request<{ organizations: OrganizationRecord[] }>(
      `/api/organizations${qs ? `?${qs}` : ""}`,
    );
  },

  getOrganization(organizationId: string) {
    return request<{ organization: OrganizationRecord }>(`/api/organizations/${organizationId}`);
  },

  suspendOrganization(organizationId: string) {
    return request<{ organization: OrganizationRecord }>(
      `/api/organizations/${organizationId}/suspend`,
      { method: "POST" },
    );
  },

  restoreOrganization(organizationId: string) {
    return request<{ organization: OrganizationRecord }>(
      `/api/organizations/${organizationId}/restore`,
      { method: "POST" },
    );
  },

  upgradeOrganizationSeats(organizationId: string, seatLimit: number) {
    return request<{ organization: OrganizationRecord }>(
      `/api/organizations/${organizationId}/seats`,
      { method: "PATCH", body: JSON.stringify({ seatLimit }) },
    );
  },

  updateOrganizationFeatureFlags(organizationId: string, featureFlags: Record<string, unknown>) {
    return request<{ organization: OrganizationRecord }>(
      `/api/organizations/${organizationId}/feature-flags`,
      { method: "PATCH", body: JSON.stringify({ featureFlags }) },
    );
  },

  listPlans(audience?: "student" | "organization") {
    const qs = audience ? `?audience=${audience}` : "";
    return request<{ plans: PlanRecord[] }>(`/api/plans${qs}`);
  },

  getOrgSeats() {
    return request<{
      seats: { purchased: number; used: number; remaining: number } | null;
    }>("/api/org/seats");
  },

  getOrgBilling() {
    return request<{ payments: PaymentRecord[]; invoices: Record<string, unknown>[] }>(
      "/api/org/billing",
    );
  },

  getMyPayments() {
    return request<{ payments: PaymentRecord[]; invoices: Record<string, unknown>[] }>(
      "/api/payments/me",
    );
  },

  createStudentCheckout(planSlug: string) {
    return request<{
      checkout: {
        paymentId: string;
        razorpayOrderId: string;
        amountPaise: number;
        currency: string;
        keyId: string;
      };
    }>("/api/payments/student/checkout", {
      method: "POST",
      body: JSON.stringify({ planSlug }),
    });
  },

  createOrganizationCheckout(planSlug: string) {
    return request<{
      checkout: {
        paymentId: string;
        razorpayOrderId: string;
        amountPaise: number;
        currency: string;
        keyId: string;
      };
    }>("/api/payments/organization/checkout", {
      method: "POST",
      body: JSON.stringify({ planSlug }),
    });
  },

  verifyPayment(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    return request<{ paymentId: string; subscriptionId?: string; alreadyCaptured?: boolean }>(
      "/api/payments/verify",
      { method: "POST", body: JSON.stringify(input) },
    );
  },

  listBatches() {
    return request<{ batches: BatchRecord[] }>("/api/org/batches");
  },

  listMyBatches() {
    return request<{ batches: BatchRecord[] }>("/api/me/batches");
  },

  createBatch(input: {
    organizationId: string;
    name: string;
    examSlug?: string;
    teacherId?: string;
    academicYear?: string;
  }) {
    return request<{ batch: BatchRecord }>("/api/org/batches", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  enrollBatchStudent(batchId: string, studentId: string) {
    return request<{ ok: true }>(`/api/org/batches/${batchId}/enrollments`, {
      method: "POST",
      body: JSON.stringify({ studentId }),
    });
  },

  listTeachers(organizationId: string) {
    return request<{ teachers: TeacherRecord[] }>(
      `/api/org/teachers?organizationId=${encodeURIComponent(organizationId)}`,
    );
  },

  createTeacher(input: {
    organizationId: string;
    fullName: string;
    email: string;
    password: string;
    subjects?: string[];
    bio?: string;
  }) {
    return request<{ teacher: TeacherRecord }>("/api/org/teachers", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

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

  getRankings(
    examSlug: string,
    options?: { period?: "all" | "weekly" | "monthly"; batchId?: string },
  ) {
    const search = new URLSearchParams();
    if (options?.period && options.period !== "all") search.set("period", options.period);
    if (options?.batchId) search.set("batchId", options.batchId);
    const qs = search.toString();
    return request<RankingSummary>(`/api/rankings/${examSlug}${qs ? `?${qs}` : ""}`);
  },

  getPlatformAnalytics() {
    return request<{
      analytics: {
        capturedPayments: number;
        revenueInr: number;
        activeOrganizations: number;
        suspendedOrganizations: number;
        studentPayments: number;
        organizationPayments: number;
      };
    }>("/api/platform/analytics");
  },

  getPlatformAuditLogs(limit = 100) {
    return request<{ logs: AuditLogRecord[] }>(`/api/platform/audit-logs?limit=${limit}`);
  },

  getOrgAuditLogs(limit = 50) {
    return request<{ logs: AuditLogRecord[] }>(`/api/org/audit-logs?limit=${limit}`);
  },

  updateOrgSettings(input: {
    name?: string;
    contactEmail?: string;
    branding?: Record<string, unknown>;
  }) {
    return request<{ organization: OrganizationRecord }>("/api/org/settings", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  importStudents(input: {
    organizationId: string;
    rows: Array<{
      fullName: string;
      email?: string;
      aliasLocal?: string;
      password?: string;
    }>;
  }) {
    return request<{
      created: Array<{ email: string; fullName: string }>;
      failures: Array<{ row: number; reason: string }>;
    }>("/api/org/students/import", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  listAttendance(batchId: string, sessionDate: string) {
    return request<{
      attendance: Array<{
        id: string;
        batch_id: string;
        student_id: string;
        session_date: string;
        status: string;
        notes: string | null;
      }>;
    }>(
      `/api/org/attendance?batchId=${encodeURIComponent(batchId)}&sessionDate=${encodeURIComponent(sessionDate)}`,
    );
  },

  markAttendance(input: {
    batchId: string;
    studentId: string;
    sessionDate: string;
    status: "present" | "absent" | "late";
    notes?: string;
  }) {
    return request<{ attendance: Record<string, unknown> }>("/api/org/attendance", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  startImpersonation(input: { targetUserId: string; reason: string; durationMinutes?: number }) {
    return request<{
      session: Record<string, unknown>;
      target: { id: string; email: string; fullName: string };
      message: string;
    }>("/api/platform/impersonate", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
