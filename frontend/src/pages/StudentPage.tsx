import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { EmptyState, PortalTabs } from "@/components/portal-tabs";
import { Card, CardHeader, StatCard } from "@/components/dashboard-cards";
import { useAuth } from "@/lib/auth";
import { api, ApiError, isBackendApiEnabled, type PaymentRecord, type PlanRecord } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/payments";
import { supabase } from "@/lib/supabase";

interface Exam {
  id: string;
  slug: string;
  name: string;
  description: string;
  coming_soon: boolean;
}

interface NoteRow {
  id: string;
  body: string;
  created_at: string;
}

interface BookmarkRow {
  id: string;
  label: string | null;
  question_id: string | null;
  created_at: string;
}

type StudentTab = "dashboard" | "subscription" | "analytics" | "notes" | "notifications";

function computeStreak(submittedDates: string[]) {
  if (submittedDates.length === 0) return 0;
  const days = [...new Set(submittedDates.map((d) => d.slice(0, 10)))].sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < days.length; i += 1) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedKey = expected.toISOString().slice(0, 10);
    if (days[i] === expectedKey) streak += 1;
    else break;
  }
  return streak;
}

export default function StudentPage() {
  const { profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<StudentTab>("dashboard");
  const [exams, setExams] = useState<Exam[]>([]);
  const [attemptCount, setAttemptCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [weakTopics, setWeakTopics] = useState<Array<{ topic: string; wrong: number }>>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [bookmarkLabel, setBookmarkLabel] = useState("");
  const [rankAlerts, setRankAlerts] = useState(true);
  const [revisionReminders, setRevisionReminders] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [payError, setPayError] = useState("");
  const [payMessage, setPayMessage] = useState("");
  const [paying, setPaying] = useState(false);
  const backendEnabled = isBackendApiEnabled();

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;

      const [
        examResult,
        attemptCountResult,
        attemptDatesResult,
        answersResult,
        notesResult,
        bookmarksResult,
        prefsResult,
      ] = await Promise.all([
        supabase
          .from("exams")
          .select("id, slug, name, description, coming_soon")
          .order("coming_soon"),
        supabase
          .from("test_attempts")
          .select("id", { count: "exact", head: true })
          .eq("student_id", profile.id),
        supabase
          .from("test_attempts")
          .select("submitted_at")
          .eq("student_id", profile.id)
          .order("submitted_at", { ascending: false })
          .limit(60),
        supabase
          .from("test_attempt_answers")
          .select("is_correct, topic_name, test_attempts!inner(student_id)")
          .eq("test_attempts.student_id", profile.id)
          .eq("is_correct", false)
          .limit(200),
        supabase
          .from("student_notes")
          .select("id, body, created_at")
          .eq("student_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("student_bookmarks")
          .select("id, label, question_id, created_at")
          .eq("student_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("student_notification_preferences")
          .select("rank_alerts, revision_reminders, email_digest")
          .eq("student_id", profile.id)
          .maybeSingle(),
      ]);

      setExams((examResult.data ?? []) as Exam[]);
      setAttemptCount(attemptCountResult.count ?? 0);
      setStreak(
        computeStreak(
          (attemptDatesResult.data ?? []).map((row) =>
            String((row as { submitted_at: string }).submitted_at),
          ),
        ),
      );

      const topicMap = new Map<string, number>();
      for (const row of answersResult.data ?? []) {
        const topic = (row as { topic_name?: string }).topic_name ?? "General";
        topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1);
      }
      setWeakTopics(
        [...topicMap.entries()]
          .map(([topic, wrong]) => ({ topic, wrong }))
          .sort((a, b) => b.wrong - a.wrong)
          .slice(0, 8),
      );

      setNotes((notesResult.data ?? []) as NoteRow[]);
      setBookmarks((bookmarksResult.data ?? []) as BookmarkRow[]);

      if (prefsResult.data) {
        setRankAlerts(prefsResult.data.rank_alerts);
        setRevisionReminders(prefsResult.data.revision_reminders);
        setEmailDigest(prefsResult.data.email_digest);
      }

      if (backendEnabled) {
        try {
          const [{ plans: studentPlans }, { payments: paymentRows }] = await Promise.all([
            api.listPlans("student"),
            api.getMyPayments(),
          ]);
          setPlans(studentPlans);
          setPayments(paymentRows);
        } catch {
          setPlans([]);
          setPayments([]);
        }
      }
    }
    load();
  }, [backendEnabled, profile?.id]);

  const revisionPlan = useMemo(
    () =>
      weakTopics.slice(0, 5).map((item, index) => ({
        day: index + 1,
        topic: item.topic,
        focus: `${item.wrong} incorrect answers — revise fundamentals and attempt a focused mock.`,
      })),
    [weakTopics],
  );

  const freeRemaining = Math.max((profile?.free_test_limit ?? 5) - attemptCount, 0);
  const isOrganizationStudent = profile?.account_type === "organization";
  const isSubscribed =
    profile?.subscription_status === "active" || profile?.subscription_status === "trialing";

  const subscribe = async (planSlug: string) => {
    if (!backendEnabled || !profile) return;
    setPaying(true);
    setPayError("");
    setPayMessage("");
    try {
      const { checkout } = await api.createStudentCheckout(planSlug);
      await openRazorpayCheckout({
        keyId: checkout.keyId,
        amountPaise: checkout.amountPaise,
        currency: checkout.currency,
        orderId: checkout.razorpayOrderId,
        title: "Abhyas",
        description: "Student monthly subscription",
        email: profile.email,
        name: profile.full_name,
        onSuccess: async (payload) => {
          await api.verifyPayment(payload);
          await refreshProfile();
          const { payments: paymentRows } = await api.getMyPayments();
          setPayments(paymentRows);
          setPayMessage("Subscription activated. You now have unlimited test submissions.");
        },
      });
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "Payment could not be completed.");
    } finally {
      setPaying(false);
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !noteBody.trim()) return;
    const { data, error } = await supabase
      .from("student_notes")
      .insert({ student_id: profile.id, body: noteBody.trim() })
      .select("id, body, created_at")
      .single();
    if (error) return;
    setNotes((prev) => [data as NoteRow, ...prev]);
    setNoteBody("");
  };

  const addBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !bookmarkLabel.trim()) return;
    const questionId = crypto.randomUUID();
    const { data, error } = await supabase
      .from("student_bookmarks")
      .insert({
        student_id: profile.id,
        label: bookmarkLabel.trim(),
        question_id: questionId,
      })
      .select("id, label, question_id, created_at")
      .single();
    if (error) return;
    setBookmarks((prev) => [data as BookmarkRow, ...prev]);
    setBookmarkLabel("");
  };

  const saveNotificationPrefs = async () => {
    if (!profile?.id) return;
    const { error } = await supabase.from("student_notification_preferences").upsert({
      student_id: profile.id,
      rank_alerts: rankAlerts,
      revision_reminders: revisionReminders,
      email_digest: emailDigest,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setPayError("Could not save notification preferences.");
      return;
    }
    setPayMessage("Notification preferences saved.");
  };

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
          Practice mocks, track weak topics, manage subscription, and stay on revision schedule.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <StatCard k="Account" v={isOrganizationStudent ? "Organization" : "Independent"} />
        <StatCard
          k="Free Tests Left"
          v={isSubscribed || isOrganizationStudent ? "Unlimited" : String(freeRemaining)}
        />
        <StatCard k="Attempts" v={String(attemptCount)} />
        <StatCard k="Practice streak" v={`${streak} day${streak === 1 ? "" : "s"}`} />
      </div>

      {(payError || payMessage) && (
        <div
          className={`mb-6 rounded-xl px-4 py-3 text-sm ${payError ? "bg-destructive/10 text-destructive" : "bg-neet/10 text-neet"}`}
        >
          {payError || payMessage}
        </div>
      )}

      <PortalTabs
        tabs={[
          { id: "dashboard", label: "Dashboard" },
          { id: "subscription", label: "Subscription" },
          { id: "analytics", label: "Analytics" },
          { id: "notes", label: "Notes" },
          { id: "notifications", label: "Notifications" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "dashboard" && (
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
      )}

      {tab === "subscription" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {!isOrganizationStudent && (
            <Card className={!isSubscribed ? "border-accent/40" : ""}>
              <CardHeader
                title={isSubscribed ? "Active subscription" : "Subscribe"}
                sub="Independent student billing"
              />
              {!isSubscribed && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {freeRemaining > 0
                    ? `${freeRemaining} free submissions remaining.`
                    : "Free quota exhausted — subscribe to continue."}
                </p>
              )}
              {plans.length > 0 && backendEnabled && !isSubscribed && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      disabled={paying}
                      onClick={() => subscribe(plan.slug)}
                      className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      Subscribe — {plan.name} (₹{plan.price_monthly_inr}/mo)
                    </button>
                  ))}
                </div>
              )}
              {isSubscribed && (
                <p className="mt-3 text-sm text-neet">Status: {profile?.subscription_status}</p>
              )}
            </Card>
          )}
          {isOrganizationStudent && (
            <Card>
              <CardHeader
                title="Organization access"
                sub="Billing managed by your coaching center"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Your institute admin manages seats and subscriptions. You have unlimited institute
                access.
              </p>
            </Card>
          )}
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
                  description="Your checkout history will appear here."
                />
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "analytics" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Weak topics" sub="Ranked by incorrect answers from your attempts" />
            {weakTopics.length > 0 ? (
              <div className="mt-4 space-y-2">
                {weakTopics.map((item) => (
                  <div
                    key={item.topic}
                    className="flex items-center justify-between rounded-xl glass px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{item.topic}</span>
                    <span className="font-mono text-muted-foreground">{item.wrong} wrong</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No analytics yet"
                description="Complete practice tests to unlock weak-topic insights."
              />
            )}
          </Card>
          <Card>
            <CardHeader title="Revision planner" sub="5-day plan from your weakest topics" />
            {revisionPlan.length > 0 ? (
              <div className="mt-4 space-y-3">
                {revisionPlan.map((item) => (
                  <div key={item.day} className="glass rounded-xl p-4 text-sm">
                    <div className="font-semibold">
                      Day {item.day}: {item.topic}
                    </div>
                    <p className="mt-1 text-muted-foreground">{item.focus}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Planner empty"
                description="Weak topics drive your revision schedule."
              />
            )}
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader
              title="AI recommendations"
              sub="Rule-based suggestions from your attempt data"
            />
            {weakTopics.length > 0 ? (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  Prioritize <strong>{weakTopics[0]?.topic}</strong> — highest error count in recent
                  attempts.
                </li>
                <li>
                  Target {Math.min(3, weakTopics.length)} weak topics this week before full-length
                  mocks.
                </li>
                <li>Maintain your {streak}-day streak with at least one scored attempt today.</li>
              </ul>
            ) : (
              <EmptyState
                title="No recommendations yet"
                description="Attempt more tests to get study guidance."
              />
            )}
          </Card>
        </div>
      )}

      {tab === "notes" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Add note" sub="Personal study notes" />
            <form onSubmit={addNote} className="mt-4 space-y-3">
              <textarea
                required
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write a revision note..."
                className="min-h-[120px] w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <button className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground">
                Save note
              </button>
            </form>
          </Card>
          <Card>
            <CardHeader title="Add bookmark" sub="Save questions or topics to revisit" />
            <form onSubmit={addBookmark} className="mt-4 space-y-3">
              <input
                required
                value={bookmarkLabel}
                onChange={(e) => setBookmarkLabel(e.target.value)}
                placeholder="Bookmark label"
                className="w-full glass rounded-xl px-4 py-3 text-sm"
              />
              <button className="w-full rounded-xl bg-foreground py-3 font-bold text-background">
                Save bookmark
              </button>
            </form>
          </Card>
          <Card>
            <CardHeader title="Notes" sub={`${notes.length} saved`} />
            <div className="mt-4 space-y-2">
              {notes.map((note) => (
                <div key={note.id} className="glass rounded-xl p-4 text-sm">
                  <p>{note.body}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {new Date(note.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <EmptyState title="No notes" description="Save revision notes here." />
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Bookmarks" sub={`${bookmarks.length} saved`} />
            <div className="mt-4 space-y-2">
              {bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="glass rounded-xl p-4 text-sm">
                  <div className="font-semibold">{bookmark.label ?? "Bookmark"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(bookmark.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {bookmarks.length === 0 && (
                <EmptyState
                  title="No bookmarks"
                  description="Bookmark tricky questions for review."
                />
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "notifications" && (
        <Card className="max-w-xl">
          <CardHeader title="Notification preferences" sub="Stored in your Abhyas profile" />
          <label className="mt-5 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={rankAlerts}
              onChange={(e) => setRankAlerts(e.target.checked)}
            />
            Rank movement alerts after eligible attempts
          </label>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={revisionReminders}
              onChange={(e) => setRevisionReminders(e.target.checked)}
            />
            Revision planner reminders for weak topics
          </label>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={emailDigest}
              onChange={(e) => setEmailDigest(e.target.checked)}
            />
            Weekly email digest (when email delivery is enabled)
          </label>
          <button
            onClick={saveNotificationPrefs}
            className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Save preferences
          </button>
        </Card>
      )}
    </PortalShell>
  );
}
