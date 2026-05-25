import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { Card, CardHeader } from "@/components/dashboard-cards";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface TestRow {
  id: string;
  title: string;
  subject: string;
  topic_name: string | null;
  duration_minutes: number;
  total_questions: number;
}

const SUBJECT_FILTERS = [
  { key: "all", label: "All Subjects", aliases: [] },
  { key: "physics", label: "Physics", aliases: ["physics"] },
  { key: "chemistry", label: "Chemistry", aliases: ["chemistry"] },
  { key: "mathematics", label: "Maths", aliases: ["mathematics", "maths", "math"] },
];

const SUBJECT_ONLY_ALIASES = new Set(["physics", "chemistry", "mathematics", "maths", "math"]);

function normalizeSubject(subject: string) {
  return subject.trim().toLowerCase();
}

function isFullMock(test: TestRow) {
  const subject = normalizeSubject(test.subject);
  return !SUBJECT_ONLY_ALIASES.has(subject);
}

export default function PracticePage() {
  const { examSlug = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tests, setTests] = useState<TestRow[]>([]);
  const activeSubject = searchParams.get("subject") ?? "all";
  const activeFilter =
    SUBJECT_FILTERS.find((filter) => filter.key === activeSubject) ?? SUBJECT_FILTERS[0];

  useEffect(() => {
    async function load() {
      const { data: exam } = await supabase
        .from("exams")
        .select("id")
        .eq("slug", examSlug)
        .single();
      if (!exam?.id) return;
      const { data } = await supabase
        .from("tests")
        .select("id, title, subject, topic_name, duration_minutes, total_questions")
        .eq("exam_id", exam.id)
        .eq("is_active", true)
        .order("created_at");
      setTests((data ?? []) as TestRow[]);
    }
    load();
  }, [examSlug]);

  const visibleTests = useMemo(() => {
    if (!activeFilter || activeFilter.key === "all") return tests.filter(isFullMock);
    return tests.filter((test) => activeFilter.aliases.includes(normalizeSubject(test.subject)));
  }, [activeFilter, tests]);

  return (
    <PortalShell>
      <div className="mb-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {examSlug.toUpperCase()} Practice
        </div>
        <h1 className="mt-2 font-display text-5xl uppercase">Practice Exams.</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Choose a test and submit it to affect your rankings and free-test quota.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUBJECT_FILTERS.map((filter) => {
          const active = filter.key === activeFilter.key;
          return (
            <button
              key={filter.key}
              onClick={() => setSearchParams({ subject: filter.key })}
              className={cn(
                "rounded-2xl border border-border px-5 py-4 text-left transition-all",
                active ? "bg-primary text-primary-foreground shadow-glow-primary" : "glass",
              )}
            >
              <div className="font-display text-2xl uppercase">{filter.label}</div>
              <div
                className={cn(
                  "mt-1 text-xs",
                  active ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {filter.key === "all" ? "Full JEE paper practice" : `${filter.label} only`}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {visibleTests.map((test) => (
          <Link
            key={test.id}
            to={`/test/${test.id}`}
            className="glass-strong rounded-3xl p-6 transition-transform hover:scale-[1.01]"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">
                {test.subject}
              </div>
              <div className="rounded-full glass px-2 py-1 text-[10px] font-mono uppercase">
                {test.duration_minutes} min
              </div>
            </div>
            <div className="font-display text-2xl uppercase">{test.title}</div>
            <div className="mt-6 grid grid-cols-2 gap-2 text-center">
              <div className="glass rounded-xl py-3">
                <div className="text-[9px] font-mono uppercase text-muted-foreground">
                  Questions
                </div>
                <div className="font-display text-xl">{test.total_questions}</div>
              </div>
              <div className="glass rounded-xl py-3">
                <div className="text-[9px] font-mono uppercase text-muted-foreground">Marks</div>
                <div className="font-display text-xl">{test.total_questions * 4}</div>
              </div>
            </div>
          </Link>
        ))}
        {visibleTests.length === 0 && (
          <Card>
            <CardHeader
              title={`No ${activeFilter.label.toLowerCase()} tests yet`}
              sub="Tests will appear here once added by developers"
            />
          </Card>
        )}
      </div>
    </PortalShell>
  );
}
