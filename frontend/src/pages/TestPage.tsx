import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, type SubmitTestResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TestRow {
  id: string;
  title: string;
  durationMinutes: number;
  examId: string;
}

interface QuestionRow {
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

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export default function TestPage() {
  const { testId = "" } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<TestRow | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [seconds, setSeconds] = useState(0);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<SubmitTestResponse["attempt"] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const session = await api.getTestSession(testId);
      setTest(session.test);
      setSeconds(session.test.durationMinutes * 60);
      setQuestions(session.questions);
    }
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load test."));
  }, [testId]);

  useEffect(() => {
    if (submitted || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds, submitted]);

  const question = questions[idx];
  const submitTest = useCallback(async () => {
    if (!test || submitted) return;
    setSubmitted(true);
    try {
      const response = await api.submitTest(test.id, {
        answers: questions.map((q) => ({
          questionId: q.id,
          answer: answers[q.id] || null,
        })),
        durationSeconds: test.durationMinutes * 60 - seconds,
      });
      setResult(response.attempt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit test.");
      setSubmitted(false);
    }
  }, [answers, questions, seconds, submitted, test]);

  useEffect(() => {
    if (seconds === 0 && test && questions.length > 0 && !submitted) {
      submitTest();
    }
  }, [questions.length, seconds, submitTest, submitted, test]);

  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  if (!test || !question) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="glass-strong rounded-2xl px-6 py-4 text-sm text-muted-foreground">
          Loading test...
        </div>
      </div>
    );
  }

  if (submitted && result && !error) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Test submitted
          </div>
          <h1 className="mt-4 font-display text-7xl uppercase">
            Score <span className="text-gradient-primary">{result.score}</span> / {result.maxScore}
          </h1>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            <ResultStat label="Correct" value={result.correctCount} />
            <ResultStat label="Wrong" value={result.wrongCount} />
            <ResultStat label="Unattempted" value={result.unattemptedCount} />
            <ResultStat label="Marks" value={result.score} />
          </div>
          <div className="mt-10 flex justify-center gap-3">
            <button
              onClick={() => navigate("/student")}
              className="rounded-xl glass px-6 py-3 font-semibold"
            >
              Student portal
            </button>
            <button
              onClick={() => navigate(-1)}
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground"
            >
              Back to practice
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Submit test?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your attempt will be counted for free-test usage and rankings.
          </p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowSubmit(false)}
              className="rounded-lg glass px-5 py-2 text-sm font-semibold"
            >
              Continue
            </button>
            <button
              onClick={submitTest}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Submit
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="sticky top-0 z-40 border-b border-border bg-black/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
          <div>
            <div className="font-display text-xl tracking-tighter text-gradient-primary">
              ABHYAS
            </div>
            <div className="hidden text-xs text-muted-foreground md:block">{test.title}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-warn/20 px-4 py-1.5 font-mono font-bold text-warn">
              {minutes}:{secs}
            </div>
            <button
              onClick={() => setShowSubmit(true)}
              className="rounded-md bg-foreground px-4 py-1.5 text-xs font-bold text-background"
            >
              Submit
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-6 max-w-[1400px] rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mx-auto grid max-w-[1400px] gap-6 px-6 py-6 lg:grid-cols-[1fr_280px]">
        <div className="glass-strong rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-4 text-xs">
            <span className="font-mono text-accent">
              QUESTION {idx + 1} / {questions.length}
            </span>
            <span className="font-mono text-muted-foreground">
              {question.subject} · {question.topicName}
            </span>
          </div>
          <div className="p-8">
            <p className="mb-8 text-lg font-medium leading-relaxed md:text-xl">
              {question.questionText}
            </p>
            {question.questionType === "numerical" ? (
              <label className="block max-w-md">
                <span className="mb-2 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Numerical answer
                </span>
                <input
                  value={answers[question.id] ?? ""}
                  onChange={(event) =>
                    setAnswers({ ...answers, [question.id]: event.target.value })
                  }
                  inputMode="decimal"
                  placeholder="Type your answer"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Integer/numerical questions have no options. Current pattern: +4 correct, 0 wrong.
                </p>
              </label>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {OPTION_KEYS.map((key) => {
                  const optionKey = `option${key}` as keyof QuestionRow;
                  const value = question[optionKey] as string | null;
                  const selected = answers[question.id] === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setAnswers({ ...answers, [question.id]: key })}
                      className={cn(
                        "text-left glass rounded-xl p-4 flex items-center gap-4",
                        selected && "border-primary bg-primary/10",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 place-items-center rounded-full text-xs font-bold",
                          selected ? "bg-primary text-primary-foreground" : "border border-border",
                        )}
                      >
                        {key}
                      </span>
                      <span>{value}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-border bg-white/3 p-4">
            <button
              onClick={() => setAnswers({ ...answers, [question.id]: "" })}
              className="rounded-lg glass px-5 py-2 text-sm font-semibold"
            >
              Clear
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setIdx(Math.max(0, idx - 1))}
                className="rounded-lg glass px-5 py-2 text-sm"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  idx === questions.length - 1 ? setShowSubmit(true) : setIdx(idx + 1)
                }
                className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
              >
                Save & Next
              </button>
            </div>
          </div>
        </div>

        <aside className="glass-strong h-fit rounded-2xl p-5 lg:sticky lg:top-24">
          <div className="mb-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Question Palette
          </div>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setIdx(i)}
                className={cn(
                  "aspect-square rounded-md text-xs font-mono font-bold",
                  i === idx && "ring-2 ring-foreground",
                  answers[q.id] ? "bg-neet text-background" : "glass text-muted-foreground",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl">{value}</div>
    </div>
  );
}
