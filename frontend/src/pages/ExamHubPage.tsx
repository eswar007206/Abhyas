import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { Card, CardHeader, StatCard } from "@/components/dashboard-cards";
import { supabase } from "@/lib/supabase";

interface Exam {
  id: string;
  slug: string;
  name: string;
  description: string;
}

const PRACTICE_MODES = [
  {
    key: "all",
    title: "All Subjects",
    sub: "Full JEE Main mocks",
    description: "Practice Physics, Chemistry, and Mathematics together like the real paper.",
  },
  {
    key: "physics",
    title: "Physics",
    sub: "Formula and speed drills",
    description: "Focus only on Physics tests and build accuracy under time pressure.",
  },
  {
    key: "chemistry",
    title: "Chemistry",
    sub: "Organic, inorganic, physical",
    description: "Practice Chemistry separately before combining it with the full paper.",
  },
  {
    key: "mathematics",
    title: "Mathematics",
    sub: "Calculation-heavy practice",
    description: "Train Maths separately for speed, accuracy, and exam temperament.",
  },
];

export default function ExamHubPage() {
  const { examSlug = "" } = useParams();
  const [exam, setExam] = useState<Exam | null>(null);
  const [testCount, setTestCount] = useState(0);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("exams")
        .select("id, slug, name, description")
        .eq("slug", examSlug)
        .single();
      setExam((data as Exam) ?? null);
      if (data?.id) {
        const { count } = await supabase
          .from("tests")
          .select("id", { count: "exact", head: true })
          .eq("exam_id", data.id);
        setTestCount(count ?? 0);
      }
    }
    load();
  }, [examSlug]);

  return (
    <PortalShell>
      <div className="mb-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Exam Hub
        </div>
        <h1 className="mt-2 font-display text-5xl uppercase">
          {exam?.name ?? examSlug.toUpperCase()}
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {exam?.description ?? "Practice exams and rankings."}
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatCard k="Practice Tests" v={String(testCount)} />
        <StatCard k="Ranking Modes" v="2" />
        <StatCard k="Exam" v={examSlug.toUpperCase()} />
      </div>

      <div className="mb-6">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Practice Modes
        </div>
        <h2 className="mt-2 font-display text-3xl uppercase">Choose how you practice.</h2>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PRACTICE_MODES.map((mode) => (
          <Link
            key={mode.key}
            to={`/student/exams/${examSlug}/practice?subject=${mode.key}`}
            className="glass-strong rounded-3xl p-6 transition-transform hover:scale-[1.01]"
          >
            <CardHeader title={mode.title} sub={mode.sub} />
            <p className="mt-4 text-sm text-muted-foreground">{mode.description}</p>
            <div className="mt-8 text-sm font-semibold">Open tests →</div>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Link
          to={`/student/exams/${examSlug}/rankings`}
          className="glass-strong rounded-3xl p-8 transition-transform hover:scale-[1.01]"
        >
          <CardHeader title="Rankings" sub="All India and organization" />
          <p className="mt-4 text-sm text-muted-foreground">
            Compare scores nationally and, if you belong to a coaching center, inside your
            organization.
          </p>
          <div className="mt-8 text-sm font-semibold">Open rankings →</div>
        </Link>
      </div>
    </PortalShell>
  );
}
