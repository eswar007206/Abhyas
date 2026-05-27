import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { EmptyState, LoadingBlock, PortalTabs } from "@/components/portal-tabs";
import { Card, CardHeader, StatCard } from "@/components/dashboard-cards";
import { useAuth, type Profile } from "@/lib/auth";
import {
  api,
  isBackendApiEnabled,
  type AuditLogRecord,
  type BatchRecord,
  type PaymentRecord,
  type PlanRecord,
  type TeacherRecord,
} from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/payments";
import { validateAliasLocal } from "@/lib/input-validation";
import { supabase } from "@/lib/supabase";

interface Organization {
  id: string;
  name: string;
  seat_limit: number;
  subdomain: string | null;
  contact_email: string | null;
  branding: Record<string, unknown>;
}

interface RelatedName {
  full_name: string;
}

interface Attempt {
  id: string;
  score: number;
  max_score: number;
  submitted_at: string;
  profiles?: RelatedName | RelatedName[] | null;
  tests?: { title: string } | { title: string }[] | null;
}

type AdminTab =
  | "dashboard"
  | "students"
  | "teachers"
  | "batches"
  | "attendance"
  | "billing"
  | "settings"
  | "activity";

function pickName(relation?: RelatedName | RelatedName[] | null): string | undefined {
  if (!relation) return undefined;
  if (Array.isArray(relation)) return relation[0]?.full_name;
  return relation.full_name;
}

function pickTitle(relation?: { title: string } | { title: string }[] | null): string | undefined {
  if (!relation) return undefined;
  if (Array.isArray(relation)) return relation[0]?.title;
  return relation.title;
}

function parseCsv(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(1)
    .map((line) => {
      const [fullName = "", email = "", aliasLocal = "", password = ""] = line
        .split(",")
        .map((cell) => cell.trim());
      return {
        fullName,
        email: email || undefined,
        aliasLocal: aliasLocal || undefined,
        password: password || undefined,
      };
    })
    .filter((row) => row.fullName);
}

export default function AdminPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [students, setStudents] = useState<Profile[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentForm, setStudentForm] = useState({
    fullName: "",
    email: "",
    password: "",
    aliasLocal: "",
  });
  const [teacherForm, setTeacherForm] = useState({
    fullName: "",
    email: "",
    password: "",
    subjects: "",
    bio: "",
  });
  const [batchForm, setBatchForm] = useState({ name: "", examSlug: "jee-main", academicYear: "" });
  const [enrollForm, setEnrollForm] = useState({ batchId: "", studentId: "" });
  const [attendanceForm, setAttendanceForm] = useState({
    batchId: "",
    sessionDate: new Date().toISOString().slice(0, 10),
    studentId: "",
    status: "present" as "present" | "absent" | "late",
  });
  const [attendanceRows, setAttendanceRows] = useState<
    Array<{ id: string; student_id: string; status: string; notes: string | null }>
  >([]);
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    contactEmail: "",
    primaryColor: "",
    logoUrl: "",
  });
  const [csvText, setCsvText] = useState("");
  const [resetForm, setResetForm] = useState({ studentId: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const backendEnabled = isBackendApiEnabled();
  const organizationId = profile?.organization_id;

  const [seatUsage, setSeatUsage] = useState<{
    purchased: number;
    used: number;
    remaining: number;
  } | null>(null);
  const usedSeats = seatUsage?.used ?? students.length;
  const seatLimit = seatUsage?.purchased ?? organization?.seat_limit ?? 0;
  const seatLabel = `${usedSeats}/${seatLimit}`;
  const limitReached = seatLimit > 0 && usedSeats >= seatLimit;
  const aliasEnabled = Boolean(organization?.subdomain);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const [
        orgResult,
        studentResult,
        attemptResult,
        seatsResponse,
        teachersResponse,
        batchesResponse,
        billingResponse,
        plansResponse,
        auditResponse,
      ] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, name, seat_limit, subdomain, contact_email, branding")
          .eq("id", organizationId)
          .single(),
        supabase
          .from("profiles")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("role", "student")
          .order("created_at", { ascending: false }),
        supabase
          .from("test_attempts")
          .select("id, score, max_score, submitted_at, profiles(full_name), tests(title)")
          .eq("organization_id", organizationId)
          .order("submitted_at", { ascending: false })
          .limit(10),
        backendEnabled
          ? api.getOrgSeats().catch(() => ({ seats: null }))
          : Promise.resolve({ seats: null }),
        backendEnabled
          ? api.listTeachers(organizationId).catch(() => ({ teachers: [] }))
          : Promise.resolve({ teachers: [] }),
        backendEnabled
          ? api.listBatches().catch(() => ({ batches: [] }))
          : Promise.resolve({ batches: [] }),
        backendEnabled
          ? api.getOrgBilling().catch(() => ({ payments: [], invoices: [] }))
          : Promise.resolve({ payments: [], invoices: [] }),
        backendEnabled
          ? api.listPlans("organization").catch(() => ({ plans: [] }))
          : Promise.resolve({ plans: [] }),
        backendEnabled
          ? api.getOrgAuditLogs().catch(() => ({ logs: [] }))
          : Promise.resolve({ logs: [] }),
      ]);

      const org = (orgResult.data as Organization) ?? null;
      setOrganization(org);
      setStudents((studentResult.data ?? []) as Profile[]);
      setAttempts((attemptResult.data ?? []) as Attempt[]);
      setSeatUsage(seatsResponse.seats);
      setTeachers(teachersResponse.teachers);
      setBatches(batchesResponse.batches);
      setPayments(billingResponse.payments);
      setInvoices(billingResponse.invoices);
      setPlans(plansResponse.plans);
      setAuditLogs(auditResponse.logs);
      if (org) {
        const branding = org.branding ?? {};
        setSettingsForm({
          name: org.name,
          contactEmail: org.contact_email ?? "",
          primaryColor: String(branding.primaryColor ?? ""),
          logoUrl: String(branding.logoUrl ?? ""),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load organization portal.");
    } finally {
      setLoading(false);
    }
  }, [backendEnabled, organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const studentOptions = useMemo(
    () =>
      students.map((student) => ({
        id: student.id,
        label: `${student.full_name} (${student.email})`,
      })),
    [students],
  );

  const exportStudentsCsv = () => {
    const header = "full_name,email\n";
    const body = students.map((s) => `${s.full_name},${s.email}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${organization?.name ?? "students"}-export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const createStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!organizationId || !backendEnabled) {
      setError("Backend API is required to create students.");
      return;
    }
    if (limitReached) {
      setError("Seat limit exceeded. Upgrade billing to add more seats.");
      return;
    }
    const aliasError = validateAliasLocal(studentForm.aliasLocal);
    if (aliasError) {
      setError(aliasError);
      return;
    }
    try {
      const data = await api.createStudent({
        organizationId,
        fullName: studentForm.fullName,
        email: studentForm.email,
        password: studentForm.password,
        aliasLocal: studentForm.aliasLocal.trim() || undefined,
      });
      setMessage(`Created student ${data.student.email}.`);
      setStudentForm({ fullName: "", email: "", password: "", aliasLocal: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create student.");
    }
  };

  const importCsv = async () => {
    if (!organizationId || !backendEnabled) return;
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      setError("CSV must include a header row and at least one student.");
      return;
    }
    try {
      const result = await api.importStudents({ organizationId, rows });
      setMessage(`Imported ${result.created.length} students. ${result.failures.length} failed.`);
      setCsvText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV import failed.");
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backendEnabled) return;
    try {
      await api.resetStudentPassword(resetForm.studentId, resetForm.newPassword);
      setMessage("Password reset successfully.");
      setResetForm({ studentId: "", newPassword: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    }
  };

  const createTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !backendEnabled) return;
    try {
      await api.createTeacher({
        organizationId,
        fullName: teacherForm.fullName,
        email: teacherForm.email,
        password: teacherForm.password,
        subjects: teacherForm.subjects
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        bio: teacherForm.bio || undefined,
      });
      setMessage("Teacher account created.");
      setTeacherForm({ fullName: "", email: "", password: "", subjects: "", bio: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create teacher.");
    }
  };

  const createBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !backendEnabled) return;
    try {
      await api.createBatch({
        organizationId,
        name: batchForm.name,
        examSlug: batchForm.examSlug,
        academicYear: batchForm.academicYear || undefined,
      });
      setMessage("Batch created.");
      setBatchForm({ name: "", examSlug: "jee-main", academicYear: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create batch.");
    }
  };

  const enrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backendEnabled) return;
    try {
      await api.enrollBatchStudent(enrollForm.batchId, enrollForm.studentId);
      setMessage("Student enrolled in batch.");
      setEnrollForm({ batchId: "", studentId: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed.");
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backendEnabled) return;
    try {
      await api.updateOrgSettings({
        name: settingsForm.name,
        contactEmail: settingsForm.contactEmail,
        branding: {
          primaryColor: settingsForm.primaryColor || undefined,
          logoUrl: settingsForm.logoUrl || undefined,
        },
      });
      setMessage("Organization settings saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    }
  };

  const loadAttendance = async (batchId: string, sessionDate: string) => {
    if (!backendEnabled || !batchId) {
      setAttendanceRows([]);
      return;
    }
    try {
      const { attendance } = await api.listAttendance(batchId, sessionDate);
      setAttendanceRows(attendance);
    } catch {
      setAttendanceRows([]);
    }
  };

  const markAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backendEnabled) return;
    try {
      await api.markAttendance(attendanceForm);
      setMessage("Attendance saved.");
      await loadAttendance(attendanceForm.batchId, attendanceForm.sessionDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save attendance.");
    }
  };

  const subscribeOrg = async (planSlug: string) => {
    if (!backendEnabled || !profile) return;
    try {
      const { checkout } = await api.createOrganizationCheckout(planSlug);
      await openRazorpayCheckout({
        keyId: checkout.keyId,
        amountPaise: checkout.amountPaise,
        currency: checkout.currency,
        orderId: checkout.razorpayOrderId,
        title: "Abhyas",
        description: "Organization seat plan",
        email: profile.email,
        name: profile.full_name,
        onSuccess: async (payload) => {
          await api.verifyPayment(payload);
          setMessage("Payment captured. Seat plan will update shortly.");
          await load();
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Billing checkout failed.");
    }
  };

  return (
    <PortalShell>
      <div className="mb-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Organization Admin
        </div>
        <h1 className="mt-2 font-display text-5xl uppercase">
          {organization?.name ?? "Your Organization"}
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Manage students, teachers, batches, billing, branding, and activity.
        </p>
      </div>

      {!backendEnabled && (
        <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Set <code className="font-mono">VITE_API_URL</code> for mutations (students, billing,
          teachers, batches).
        </div>
      )}

      {(message || error) && (
        <div
          className={`mb-6 rounded-xl px-4 py-3 text-sm ${error ? "bg-destructive/10 text-destructive" : "bg-neet/10 text-neet"}`}
        >
          {error || message}
        </div>
      )}

      <PortalTabs
        tabs={[
          { id: "dashboard", label: "Dashboard" },
          { id: "students", label: "Students" },
          { id: "teachers", label: "Teachers" },
          { id: "batches", label: "Batches" },
          { id: "attendance", label: "Attendance" },
          { id: "billing", label: "Billing" },
          { id: "settings", label: "Settings" },
          { id: "activity", label: "Activity" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? (
        <LoadingBlock label="Loading organization portal..." />
      ) : tab === "dashboard" ? (
        <>
          <div className="mb-8 grid gap-4 md:grid-cols-4">
            <StatCard
              k="Seat Usage"
              v={seatLabel}
              color={limitReached ? "var(--color-destructive)" : undefined}
            />
            <StatCard k="Students" v={String(usedSeats)} />
            <StatCard k="Teachers" v={String(teachers.length)} />
            <StatCard k="Batches" v={String(batches.length)} />
          </div>
          <Card>
            <CardHeader
              title="Recent Activity"
              sub="Latest test submissions in your organization"
            />
            <div className="mt-5 space-y-3">
              {attempts.map((attempt) => (
                <div key={attempt.id} className="glass rounded-xl p-4">
                  <div className="flex justify-between gap-4">
                    <div>
                      <div className="font-semibold">{pickName(attempt.profiles) ?? "Student"}</div>
                      <div className="text-xs text-muted-foreground">
                        {pickTitle(attempt.tests) ?? "Practice test"}
                      </div>
                    </div>
                    <div className="font-mono text-sm">
                      {attempt.score}/{attempt.max_score}
                    </div>
                  </div>
                </div>
              ))}
              {attempts.length === 0 && (
                <EmptyState
                  title="No attempts yet"
                  description="Student submissions will appear here."
                />
              )}
            </div>
          </Card>
        </>
      ) : tab === "students" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Create Student"
              sub="Issue credentials to coaching-center students"
            />
            <form onSubmit={createStudent} className="mt-5 space-y-3">
              <input
                required
                placeholder="Student full name"
                value={studentForm.fullName}
                onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              {aliasEnabled && (
                <input
                  placeholder={`Alias (rollno@${organization?.subdomain}.abhyas.in)`}
                  value={studentForm.aliasLocal}
                  onChange={(e) =>
                    setStudentForm({
                      ...studentForm,
                      aliasLocal: e.target.value.toLowerCase().replace(/\s+/g, ""),
                    })
                  }
                  className="w-full glass rounded-xl px-4 py-3 text-sm"
                />
              )}
              <input
                required={!studentForm.aliasLocal.trim()}
                type="email"
                placeholder="Email"
                value={studentForm.email}
                onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <input
                required
                type="password"
                minLength={8}
                placeholder="Temporary password"
                value={studentForm.password}
                onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <button
                disabled={limitReached || !backendEnabled}
                className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
              >
                Create student
              </button>
            </form>
          </Card>
          <Card>
            <CardHeader title="CSV Import" sub="Header: full_name,email,alias_local,password" />
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={
                "full_name,email,alias_local,password\nRahul Kumar,rahul@example.com,rahul001,Abhyas@123456"
              }
              className="mt-4 min-h-[140px] w-full glass rounded-xl px-4 py-3 text-sm font-mono"
            />
            <button
              disabled={!backendEnabled}
              onClick={importCsv}
              className="mt-3 w-full rounded-xl bg-foreground py-3 font-bold text-background disabled:opacity-50"
            >
              Import CSV
            </button>
          </Card>
          <Card>
            <CardHeader title="Students" sub={`${students.length} accounts`} />
            <button
              onClick={exportStudentsCsv}
              className="mb-4 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
            >
              Export CSV
            </button>
            <div className="space-y-3">
              {students.map((student) => (
                <div key={student.id} className="glass rounded-xl p-4">
                  <div className="font-semibold">{student.full_name}</div>
                  <div className="text-xs text-muted-foreground">{student.email}</div>
                </div>
              ))}
              {students.length === 0 && (
                <EmptyState title="No students" description="Create or import student accounts." />
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Reset Password" sub="Select a student account" />
            <form onSubmit={resetPassword} className="mt-5 space-y-3">
              <select
                required
                value={resetForm.studentId}
                onChange={(e) => setResetForm({ ...resetForm, studentId: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              >
                <option value="">Select student</option>
                {studentOptions.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.label}
                  </option>
                ))}
              </select>
              <input
                required
                type="password"
                minLength={8}
                placeholder="New password"
                value={resetForm.newPassword}
                onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <button
                disabled={!backendEnabled}
                className="w-full rounded-xl bg-foreground py-3 font-bold text-background disabled:opacity-50"
              >
                Reset password
              </button>
            </form>
          </Card>
        </div>
      ) : tab === "teachers" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Add Teacher" sub="Teachers can be assigned to batches" />
            <form onSubmit={createTeacher} className="mt-5 space-y-3">
              <input
                required
                placeholder="Full name"
                value={teacherForm.fullName}
                onChange={(e) => setTeacherForm({ ...teacherForm, fullName: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={teacherForm.email}
                onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <input
                required
                type="password"
                minLength={8}
                placeholder="Temporary password"
                value={teacherForm.password}
                onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <input
                placeholder="Subjects (comma separated)"
                value={teacherForm.subjects}
                onChange={(e) => setTeacherForm({ ...teacherForm, subjects: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <textarea
                placeholder="Bio (optional)"
                value={teacherForm.bio}
                onChange={(e) => setTeacherForm({ ...teacherForm, bio: e.target.value })}
                className="min-h-[80px] w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <button
                disabled={!backendEnabled}
                className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
              >
                Create teacher
              </button>
            </form>
          </Card>
          <Card>
            <CardHeader title="Teachers" sub={`${teachers.length} active`} />
            <div className="mt-5 space-y-3">
              {teachers.map((teacher) => (
                <div key={teacher.id} className="glass rounded-xl p-4">
                  <div className="font-semibold">{teacher.subjects.join(", ") || "Teacher"}</div>
                  <div className="text-xs text-muted-foreground">{teacher.bio ?? "No bio"}</div>
                </div>
              ))}
              {teachers.length === 0 && (
                <EmptyState
                  title="No teachers"
                  description="Add teacher accounts for your center."
                />
              )}
            </div>
          </Card>
        </div>
      ) : tab === "batches" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Create Batch" sub="Group students for reporting and rankings" />
            <form onSubmit={createBatch} className="mt-5 space-y-3">
              <input
                required
                placeholder="Batch name"
                value={batchForm.name}
                onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <input
                placeholder="Exam slug (jee-main)"
                value={batchForm.examSlug}
                onChange={(e) => setBatchForm({ ...batchForm, examSlug: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <input
                placeholder="Academic year"
                value={batchForm.academicYear}
                onChange={(e) => setBatchForm({ ...batchForm, academicYear: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <button
                disabled={!backendEnabled}
                className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
              >
                Create batch
              </button>
            </form>
          </Card>
          <Card>
            <CardHeader title="Enroll Student" sub="Assign students to a batch" />
            <form onSubmit={enrollStudent} className="mt-5 space-y-3">
              <select
                required
                value={enrollForm.batchId}
                onChange={(e) => setEnrollForm({ ...enrollForm, batchId: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              >
                <option value="">Select batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
              <select
                required
                value={enrollForm.studentId}
                onChange={(e) => setEnrollForm({ ...enrollForm, studentId: e.target.value })}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              >
                <option value="">Select student</option>
                {studentOptions.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.label}
                  </option>
                ))}
              </select>
              <button
                disabled={!backendEnabled}
                className="w-full rounded-xl bg-foreground py-3 font-bold text-background disabled:opacity-50"
              >
                Enroll student
              </button>
            </form>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Batches" sub={`${batches.length} batches`} />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {batches.map((batch) => (
                <div key={batch.id} className="glass rounded-xl p-4">
                  <div className="font-semibold">{batch.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {batch.exam_slug ?? "Any exam"} · {batch.status}
                    {batch.academic_year ? ` · ${batch.academic_year}` : ""}
                  </div>
                </div>
              ))}
              {batches.length === 0 && (
                <EmptyState title="No batches" description="Create batches to organize students." />
              )}
            </div>
          </Card>
        </div>
      ) : tab === "attendance" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Mark attendance" sub="Daily batch roll call" />
            <form onSubmit={markAttendance} className="mt-5 space-y-3">
              <select
                required
                value={attendanceForm.batchId}
                onChange={(e) => {
                  const batchId = e.target.value;
                  setAttendanceForm({ ...attendanceForm, batchId });
                  loadAttendance(batchId, attendanceForm.sessionDate);
                }}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              >
                <option value="">Select batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
              <input
                required
                type="date"
                value={attendanceForm.sessionDate}
                onChange={(e) => {
                  const sessionDate = e.target.value;
                  setAttendanceForm({ ...attendanceForm, sessionDate });
                  if (attendanceForm.batchId) loadAttendance(attendanceForm.batchId, sessionDate);
                }}
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <select
                required
                value={attendanceForm.studentId}
                onChange={(e) =>
                  setAttendanceForm({ ...attendanceForm, studentId: e.target.value })
                }
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              >
                <option value="">Select student</option>
                {studentOptions.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.label}
                  </option>
                ))}
              </select>
              <select
                value={attendanceForm.status}
                onChange={(e) =>
                  setAttendanceForm({
                    ...attendanceForm,
                    status: e.target.value as "present" | "absent" | "late",
                  })
                }
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>
              <button
                disabled={!backendEnabled}
                className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
              >
                Save attendance
              </button>
            </form>
          </Card>
          <Card>
            <CardHeader title="Session roster" sub={`${attendanceRows.length} records`} />
            <div className="mt-5 space-y-3">
              {attendanceRows.map((row) => {
                const student = students.find((s) => s.id === row.student_id);
                return (
                  <div key={row.id} className="glass rounded-xl p-4 text-sm">
                    <div className="font-semibold">{student?.full_name ?? row.student_id}</div>
                    <div className="text-xs capitalize text-muted-foreground">{row.status}</div>
                  </div>
                );
              })}
              {attendanceRows.length === 0 && (
                <EmptyState
                  title="No attendance yet"
                  description="Mark attendance for a batch and date."
                />
              )}
            </div>
          </Card>
        </div>
      ) : tab === "billing" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Seat plan" sub="Upgrade organization seats via Razorpay" />
            <p className="mt-3 text-sm text-muted-foreground">
              Current usage: {seatLabel}. Captured payments activate seat limits on your
              organization.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  disabled={!backendEnabled}
                  onClick={() => subscribeOrg(plan.slug)}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {plan.name} — ₹{plan.price_monthly_inr}/mo ({plan.seat_limit ?? "∞"} seats)
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Payment history" sub={`${payments.length} records`} />
            <div className="mt-5 space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="glass rounded-xl p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold capitalize">{payment.status}</span>
                    <span className="font-mono">₹{Math.round(payment.amount_paise / 100)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(payment.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <EmptyState
                  title="No payments"
                  description="Organization billing history appears here."
                />
              )}
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Invoices" sub={`${invoices.length} invoices`} />
            <div className="mt-5 space-y-3">
              {invoices.map((invoice) => (
                <div key={String(invoice.id)} className="glass rounded-xl p-4 text-sm">
                  <div className="font-semibold">
                    {String(invoice.invoice_number ?? invoice.id)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Payment {String(invoice.payment_id ?? "")}
                  </div>
                </div>
              ))}
              {invoices.length === 0 && (
                <EmptyState
                  title="No invoices"
                  description="Invoices are generated after captured payments."
                />
              )}
            </div>
          </Card>
        </div>
      ) : tab === "settings" ? (
        <Card className="max-w-xl">
          <CardHeader title="Organization settings" sub="Branding and contact details" />
          <form onSubmit={saveSettings} className="mt-5 space-y-3">
            <input
              required
              value={settingsForm.name}
              onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
              placeholder="Organization name"
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            <input
              type="email"
              value={settingsForm.contactEmail}
              onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })}
              placeholder="Contact email"
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            <input
              value={settingsForm.primaryColor}
              onChange={(e) => setSettingsForm({ ...settingsForm, primaryColor: e.target.value })}
              placeholder="Primary color (#2563eb)"
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            <input
              value={settingsForm.logoUrl}
              onChange={(e) => setSettingsForm({ ...settingsForm, logoUrl: e.target.value })}
              placeholder="Logo URL"
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            <button
              disabled={!backendEnabled}
              className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
            >
              Save settings
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Activity log" sub="Organization audit trail from backend actions" />
          <div className="mt-5 space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="glass rounded-xl p-4 text-sm">
                <div className="font-semibold">{log.action}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString()} · {log.entity_type}
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <EmptyState
                title="No activity yet"
                description="Suspend, billing, imports, and settings changes are logged here."
              />
            )}
          </div>
        </Card>
      )}
    </PortalShell>
  );
}
