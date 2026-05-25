import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { Card, CardHeader, StatCard } from "@/components/dashboard-cards";
import { useAuth, type Profile } from "@/lib/auth";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface Organization {
  id: string;
  name: string;
  seat_limit: number;
}

interface Attempt {
  id: string;
  score: number;
  max_score: number;
  submitted_at: string;
  profiles?: { full_name: string } | null;
  tests?: { title: string } | null;
}

export default function AdminPage() {
  const { profile } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [students, setStudents] = useState<Profile[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [studentForm, setStudentForm] = useState({ fullName: "", email: "", password: "" });
  const [resetForm, setResetForm] = useState({ studentId: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const organizationId = profile?.organization_id;
  const usedSeats = students.length;
  const seatLimit = organization?.seat_limit ?? 0;
  const seatLabel = `${usedSeats}/${seatLimit}`;
  const limitReached = seatLimit > 0 && usedSeats >= seatLimit;

  const load = useCallback(async () => {
    if (!organizationId) return;
    const [{ data: orgRows }, { data: studentRows }, { data: attemptRows }] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, seat_limit")
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
    ]);
    setOrganization((orgRows as Organization) ?? null);
    setStudents((studentRows ?? []) as Profile[]);
    setAttempts((attemptRows ?? []) as Attempt[]);
  }, [organizationId]);

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

  const createStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!organizationId) return;
    if (limitReached) {
      setError("Seat limit exceeded. Contact sales to add more seats.");
      return;
    }

    try {
      const data = await api.createStudent({ organizationId, ...studentForm });
      setMessage(`Created student ${data.student.email}.`);
      setStudentForm({ fullName: "", email: "", password: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create student.");
      return;
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.resetStudentPassword(resetForm.studentId, resetForm.newPassword);
      setMessage("Password reset successfully.");
      setResetForm({ studentId: "", newPassword: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
      return;
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
          Create student credentials, reset passwords, and review student activity.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatCard
          k="Seat Usage"
          v={seatLabel}
          color={limitReached ? "var(--color-destructive)" : undefined}
        />
        <StatCard k="Students Created" v={String(usedSeats)} />
        <StatCard k="Recent Attempts" v={String(attempts.length)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Create Student Account"
            sub="Credentials are given to students by the coaching center"
          />
          <form onSubmit={createStudent} className="mt-5 space-y-3">
            <input
              required
              placeholder="Student full name"
              value={studentForm.fullName}
              onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            <input
              required
              type="email"
              placeholder="Student email"
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
              disabled={limitReached}
              className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
            >
              {limitReached ? "Seat limit exceeded" : "Create student"}
            </button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Reset Password" sub="Choose an organization student" />
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
            <button className="w-full rounded-xl bg-foreground py-3 font-bold text-background">
              Reset password
            </button>
          </form>
        </Card>
      </div>

      {(message || error) && (
        <div
          className={`mt-5 rounded-xl px-4 py-3 text-sm ${error ? "bg-destructive/10 text-destructive" : "bg-neet/10 text-neet"}`}
        >
          {error || message}
        </div>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Students" sub="All created accounts" />
          <div className="mt-5 space-y-3">
            {students.map((student) => (
              <div key={student.id} className="glass rounded-xl p-4">
                <div className="font-semibold">{student.full_name}</div>
                <div className="text-xs text-muted-foreground">{student.email}</div>
              </div>
            ))}
            {students.length === 0 && (
              <p className="text-sm text-muted-foreground">No students created yet.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Activity" sub="Latest organization test submissions" />
          <div className="mt-5 space-y-3">
            {attempts.map((attempt) => (
              <div key={attempt.id} className="glass rounded-xl p-4">
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="font-semibold">{attempt.profiles?.full_name ?? "Student"}</div>
                    <div className="text-xs text-muted-foreground">
                      {attempt.tests?.title ?? "Practice test"}
                    </div>
                  </div>
                  <div className="font-mono text-sm">
                    {attempt.score}/{attempt.max_score}
                  </div>
                </div>
              </div>
            ))}
            {attempts.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
          </div>
        </Card>
      </div>
    </PortalShell>
  );
}
