import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { Card, CardHeader, StatCard } from "@/components/dashboard-cards";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface Exam {
  id: string;
  slug: string;
  name: string;
  description: string;
  coming_soon: boolean;
}

export default function StudentPage() {
  const { profile } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    async function load() {
      const [{ data: examRows }, { count }] = await Promise.all([
        supabase
          .from("exams")
          .select("id, slug, name, description, coming_soon")
          .order("coming_soon"),
        supabase
          .from("test_attempts")
          .select("id", { count: "exact", head: true })
          .eq("student_id", profile?.id ?? ""),
      ]);
      setExams((examRows ?? []) as Exam[]);
      setAttemptCount(count ?? 0);
    }
    load();
  }, [profile?.id]);

  const freeRemaining = Math.max((profile?.free_test_limit ?? 5) - attemptCount, 0);
  const isOrganizationStudent = profile?.account_type === "organization";
  const isSubscribed =
    profile?.subscription_status === "active" || profile?.subscription_status === "trialing";

  return (
    <PortalShell>
      <div className="mb-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Student Portal
        </div>
        <h1 className="mt-2 font-display text-5xl uppercase">
          Welcome, {profile?.full_name ?? "Student"}.
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Choose an exam, practice mocks, and track rankings.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatCard k="Account" v={isOrganizationStudent ? "Organization" : "Independent"} />
        <StatCard
          k="Free Tests Left"
          v={isSubscribed || isOrganizationStudent ? "Unlimited" : String(freeRemaining)}
        />
        <StatCard k="Attempts" v={String(attemptCount)} />
      </div>

      {!isOrganizationStudent && !isSubscribed && (
        <Card className="mb-8 border-accent/40">
          <CardHeader
            title={freeRemaining > 0 ? "Free plan active" : "Monthly subscription required"}
            sub="Independent student access"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Independent students get 5 free test submissions. Subscribe monthly to continue after
            the free quota.
          </p>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {exams.map((exam) =>
          exam.coming_soon ? (
            <div key={exam.id} className="glass-strong rounded-3xl p-6 opacity-70">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">
                Coming soon
              </div>
              <div className="mt-3 font-display text-3xl uppercase">{exam.name}</div>
              <p className="mt-3 text-sm text-muted-foreground">{exam.description}</p>
            </div>
          ) : (
            <Link
              key={exam.id}
              to={`/student/exams/${exam.slug}`}
              className="glass-strong rounded-3xl p-6 transition-transform hover:scale-[1.01]"
            >
              <div className="text-[10px] font-mono uppercase text-muted-foreground">
                Available now
              </div>
              <div className="mt-3 font-display text-4xl uppercase text-gradient-primary">
                {exam.name}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{exam.description}</p>
              <div className="mt-8 text-sm font-semibold">Open {exam.name} →</div>
            </Link>
          ),
        )}
      </div>
    </PortalShell>
  );
}
