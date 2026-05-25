import { Link } from "react-router-dom";
import { Card, CardHeader } from "@/components/dashboard-cards";

const FEATURES = [
  "Organization seat management",
  "Student practice exams",
  "All India and organization rankings",
  "Monthly plans for independent students",
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 glass border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="font-display text-2xl tracking-tighter text-gradient-primary">
            ABHYAS
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Login
            </Link>
            <Link
              to="/login"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden px-6 py-28">
          <div className="absolute left-1/2 top-0 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex rounded-full glass px-3 py-1 text-xs font-mono uppercase tracking-widest">
                Mock prep platform for institutes and students
              </div>
              <h1 className="font-display text-6xl uppercase leading-[0.9] tracking-tighter md:text-8xl">
                Practice. Rank. Improve.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Abhyas gives coaching centers a managed student testing portal and gives independent
                students a simple subscription path for JEE and NEET practice.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/login"
                  className="rounded-xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground hover:shadow-glow-primary"
                >
                  Login to Abhyas
                </Link>
                <a href="#plans" className="rounded-xl glass px-8 py-4 text-lg font-semibold">
                  See platform flow
                </a>
              </div>
            </div>

            <Card className="space-y-5">
              <CardHeader title="Three Portals" sub="One login decides the destination" />
              {[
                ["Developer", "Create organizations, configure seats, manage exams."],
                ["Organization Admin", "Create student accounts, reset passwords, view activity."],
                ["Student", "Practice JEE/NEET, see rankings, manage free tests or subscription."],
              ].map(([title, copy]) => (
                <div key={title} className="glass rounded-2xl p-5">
                  <div className="font-display text-2xl uppercase">{title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
                </div>
              ))}
            </Card>
          </div>
        </section>

        <section id="plans" className="border-y border-border bg-white/[0.015] px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-2xl">
              <div className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                How Abhyas works
              </div>
              <h2 className="font-display text-5xl uppercase">
                Built for institutes and individual learners.
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <CardHeader title="Coaching Center" sub="Example: 450 students" />
                <p className="mt-4 text-sm text-muted-foreground">
                  We create an admin account for the organization. The admin sees seat usage like
                  0/450, creates student credentials, resets passwords, and monitors attempts and
                  scores.
                </p>
              </Card>
              <Card>
                <CardHeader title="Independent Student" sub="Free first, paid when ready" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Students can create their own account, get 5 free tests, access All India
                  rankings, and upgrade monthly for continued access. Organization rankings stay
                  locked unless they belong to an organization.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section className="px-6 py-24">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature} className="glass-strong rounded-2xl p-5 text-sm font-semibold">
                {feature}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
