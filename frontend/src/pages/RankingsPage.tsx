import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { Card, CardHeader } from "@/components/dashboard-cards";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { RankingRow, RankingSummary } from "@/lib/api";

interface RankingEntryRow {
  attempt_id: string;
  full_name: string;
  test_title: string;
  score: number;
  max_score: number;
  rank: number | null;
  rank_delta: number | null;
  previous_rank: number | null;
  state: string | null;
  city: string | null;
  organization_name: string | null;
  submitted_at: string;
  average_score: number | null;
  attempt_count: number | null;
}

const RANKING_COLUMNS =
  "attempt_id, full_name, test_title, score, max_score, rank, rank_delta, previous_rank, state, city, organization_name, submitted_at, average_score, attempt_count";

function mapRanking(row: RankingEntryRow): RankingRow {
  return {
    attemptId: row.attempt_id,
    fullName: row.full_name,
    testTitle: row.test_title,
    score: row.score,
    maxScore: row.max_score,
    rank: row.rank,
    rankDelta: row.rank_delta,
    previousRank: row.previous_rank,
    state: row.state,
    city: row.city,
    organizationName: row.organization_name,
    submittedAt: row.submitted_at,
    averageScore: row.average_score,
    attemptCount: row.attempt_count,
  };
}

type RankingScoreKind = "raw" | "average";

function formatRankingScore(row: RankingRow, scoreKind: RankingScoreKind) {
  if (scoreKind === "average") {
    const average = row.averageScore ?? row.score;
    return `${average.toFixed(1)} avg`;
  }

  return row.score.toLocaleString();
}

function MovementCard({ movement }: { movement: RankingSummary["movement"] }) {
  if (!movement?.currentRank || !movement.previousRank || movement.delta === null) return null;

  const improved = movement.delta > 0;
  return (
    <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-primary">
        Rank movement
      </div>
      <div className="mt-2 font-display text-4xl">
        {movement.previousRank.toLocaleString()} → {movement.currentRank.toLocaleString()}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {improved ? "Improved" : "Moved"} {Math.abs(movement.delta).toLocaleString()} positions
        since your previous ranked attempt.
      </p>
    </div>
  );
}

function RankingList({ rows, scoreKind }: { rows: RankingRow[]; scoreKind: RankingScoreKind }) {
  if (rows.length === 0)
    return (
      <p className="mt-5 text-sm text-muted-foreground">
        No eligible students yet. Students appear here after more than 25 tests.
      </p>
    );

  return (
    <div className="mt-5 space-y-3">
      {rows.map((row) => (
        <div key={`${row.attemptId}-${row.rank}`} className="glass rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">
                #{row.rank ?? "-"} {row.fullName ?? "Student"}
              </div>
              <div className="text-xs text-muted-foreground">
                {row.testTitle ?? "Practice test"}
                {row.state ? ` · ${row.state}` : ""}
                {row.city ? ` · ${row.city}` : ""}
                {row.attemptCount ? ` · ${row.attemptCount} tests` : ""}
              </div>
            </div>
            <div className="text-right font-mono text-sm">
              <div>{formatRankingScore(row, scoreKind)}</div>
              <div className="mt-1 text-[10px] uppercase text-muted-foreground">
                {scoreKind === "average" ? "average marks" : "total raw marks"}
              </div>
              {row.rankDelta !== null && row.rankDelta !== undefined && (
                <div className={row.rankDelta > 0 ? "text-neet" : "text-muted-foreground"}>
                  {row.rankDelta > 0 ? "↑" : "↓"} {Math.abs(row.rankDelta)}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type RankingCategory = "air" | "state" | "city";

const RANKING_CATEGORIES: Array<{
  key: RankingCategory;
  label: string;
  eyebrow: string;
  description: string;
}> = [
  {
    key: "air",
    label: "AIR",
    eyebrow: "All India Rank",
    description: "Compete with every JEE student on Abhyas.",
  },
  {
    key: "state",
    label: "State Rankings",
    eyebrow: "Local competition",
    description: "See where you stand inside your saved state.",
  },
  {
    key: "city",
    label: "City Rankings",
    eyebrow: "Closest competition",
    description: "Compare with students from your saved city.",
  },
];

function getRankingRows(summary: RankingSummary, category: RankingCategory) {
  switch (category) {
    case "air":
      return {
        raw: summary.publicRankings.allIndiaRaw,
        average: summary.publicRankings.allIndiaAverage,
        title: "All India Rank",
        rawTitle: "AIR by raw marks",
        averageTitle: "AIR by average marks",
      };
    case "state":
      return {
        raw: summary.publicRankings.stateRaw,
        average: summary.publicRankings.stateAverage,
        title: "State Rankings",
        rawTitle: "State by raw marks",
        averageTitle: "State by average marks",
      };
    case "city":
      return {
        raw: summary.publicRankings.cityRaw,
        average: summary.publicRankings.cityAverage,
        title: "City Rankings",
        rawTitle: "City by raw marks",
        averageTitle: "City by average marks",
      };
  }
}

export default function RankingsPage() {
  const { examSlug = "" } = useParams();
  const { profile } = useAuth();
  const [summary, setSummary] = useState<RankingSummary | null>(null);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<RankingCategory | null>(null);

  useEffect(() => {
    async function load() {
      if (!profile) return;

      const movementResult = await supabase
        .from("ranking_entries")
        .select(RANKING_COLUMNS)
        .eq("exam_slug", examSlug)
        .eq("scope", "all_india_raw")
        .eq("student_id", profile.id)
        .order("submitted_at", { ascending: false })
        .limit(1);
      if (movementResult.error) throw movementResult.error;

      const getRows = async (scope: string, filters: Record<string, string | null> = {}) => {
        let query = supabase
          .from("ranking_entries")
          .select(RANKING_COLUMNS)
          .eq("exam_slug", examSlug)
          .eq("scope", scope)
          .order("rank", { ascending: true })
          .limit(20);

        for (const [key, value] of Object.entries(filters)) {
          if (value) query = query.eq(key, value);
        }

        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        return ((data ?? []) as RankingEntryRow[]).map(mapRanking);
      };

      const [
        allIndiaRaw,
        stateRaw,
        cityRaw,
        organizationRaw,
        allIndiaAverage,
        stateAverage,
        cityAverage,
        organizationAverage,
      ] = await Promise.all([
        getRows("all_india_raw"),
        profile.state ? getRows("state_raw", { state: profile.state }) : Promise.resolve([]),
        profile.city ? getRows("city_raw", { city: profile.city }) : Promise.resolve([]),
        profile.organization_id
          ? getRows("organization_raw", { organization_id: profile.organization_id })
          : Promise.resolve([]),
        getRows("all_india_average"),
        profile.state ? getRows("state_average", { state: profile.state }) : Promise.resolve([]),
        profile.city ? getRows("city_average", { city: profile.city }) : Promise.resolve([]),
        profile.organization_id
          ? getRows("organization_average", { organization_id: profile.organization_id })
          : Promise.resolve([]),
      ]);

      const movementRow = ((movementResult.data ?? []) as RankingEntryRow[]).map(mapRanking)[0];

      setSummary({
        publicRankings: {
          allIndiaRaw,
          stateRaw,
          cityRaw,
          allIndiaAverage,
          stateAverage,
          cityAverage,
        },
        organizationRankings: profile.organization_id
          ? {
              raw: organizationRaw,
              average: organizationAverage,
            }
          : null,
        movement: movementRow
          ? {
              currentRank: movementRow.rank,
              previousRank: movementRow.previousRank,
              delta: movementRow.rankDelta,
            }
          : null,
      });
    }
    load().catch((err) =>
      setError(err instanceof Error ? err.message : "Could not load rankings."),
    );
  }, [examSlug, profile]);

  return (
    <PortalShell>
      <div className="mb-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {examSlug.toUpperCase()} Rankings
        </div>
        <h1 className="mt-2 font-display text-5xl uppercase">Rankings.</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Everyone can view raw and average rankings. Students appear only after more than 25 tests.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {summary && <MovementCard movement={summary.movement} />}

      <div className="grid gap-5 md:grid-cols-3">
        {RANKING_CATEGORIES.map((category) => {
          const active = selectedCategory === category.key;
          const locationLabel =
            category.key === "state"
              ? profile?.state
              : category.key === "city"
                ? profile?.city
                : null;

          return (
            <button
              key={category.key}
              onClick={() => setSelectedCategory(category.key)}
              className={`rounded-3xl border p-6 text-left transition-all ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-glow-primary"
                  : "glass-strong border-border hover:scale-[1.01]"
              }`}
            >
              <div
                className={`text-[10px] font-mono uppercase tracking-widest ${
                  active ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}
              >
                {category.eyebrow}
              </div>
              <div className="mt-3 font-display text-4xl uppercase">{category.label}</div>
              <p
                className={`mt-3 text-sm ${
                  active ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}
              >
                {category.description}
              </p>
              {locationLabel && (
                <div className="mt-5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                  {locationLabel}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {!selectedCategory && (
        <div className="mt-6 rounded-2xl border border-border bg-white/3 p-5 text-sm text-muted-foreground">
          Select AIR, State Rankings, or City Rankings to view Raw Marks and Average Marks.
        </div>
      )}

      {summary && selectedCategory && (
        <Card className="mt-6">
          <CardHeader
            title={getRankingRows(summary, selectedCategory).title}
            sub="Raw marks and average marks for eligible students"
          />
          {selectedCategory === "state" && !profile?.state ? (
            <div className="rounded-2xl border border-border bg-white/3 p-6">
              <div className="font-semibold">State is missing</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your state to your profile to unlock state rankings.
              </p>
            </div>
          ) : selectedCategory === "city" && !profile?.city ? (
            <div className="rounded-2xl border border-border bg-white/3 p-6">
              <div className="font-semibold">City is missing</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your city to your profile to unlock city rankings.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold">
                  {getRankingRows(summary, selectedCategory).rawTitle}
                </h3>
                <RankingList rows={getRankingRows(summary, selectedCategory).raw} scoreKind="raw" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {getRankingRows(summary, selectedCategory).averageTitle}
                </h3>
                <RankingList
                  rows={getRankingRows(summary, selectedCategory).average}
                  scoreKind="average"
                />
              </div>
            </div>
          )}
        </Card>
      )}
    </PortalShell>
  );
}
