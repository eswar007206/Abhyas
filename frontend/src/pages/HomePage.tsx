import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Building2,
  GraduationCap,
  LineChart,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.32, 0.72, 0, 1] as const },
  }),
};

const PORTALS = [
  {
    icon: Building2,
    title: "Developer",
    tag: "Platform ops",
    copy: "Spin up coaching centers, assign seat pools, wire subscriptions, and ship new mock tests.",
    accent: "border-jee/40 bg-jee/5",
  },
  {
    icon: Users,
    title: "Org Admin",
    tag: "Coaching center",
    copy: "Create student logins, reset passwords, track seat usage, and monitor attempt activity.",
    accent: "border-both/40 bg-both/5",
  },
  {
    icon: GraduationCap,
    title: "Student",
    tag: "Practice & rank",
    copy: "Take timed mocks, climb All India rankings, and unlock org leaderboards when enrolled.",
    accent: "border-neet/40 bg-neet/5",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Institute onboarded",
    body: "We provision your org, subdomain, and admin credentials in minutes.",
  },
  {
    n: "02",
    title: "Students practice",
    body: "Full-length and subject-wise JEE mocks with server-side grading.",
  },
  {
    n: "03",
    title: "Rankings update",
    body: "AIR, state, city, and organization boards refresh after every attempt.",
  },
] as const;

const STATS = [
  { label: "Ranking scopes live", value: "AIR · State · City · Org" },
  { label: "Free tests / independent student", value: "5" },
  { label: "Server-graded attempts", value: "Yes" },
  { label: "Exam tracks", value: "JEE · NEET" },
] as const;

function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-display text-2xl tracking-tighter text-gradient-primary">
            ABHYAS
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#portals"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Portals
            </a>
            <a
              href="#flow"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              How it works
            </a>
            <a
              href="#exams"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Exams
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:shadow-lg"
            >
              Start free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.55_0.18_220/0.25),transparent)]" />
        <div className="absolute inset-0 bg-grid-light opacity-80" />
        <div className="absolute -right-32 top-20 size-[420px] rounded-full bg-neet/15 blur-[100px]" />
        <div className="absolute -left-24 bottom-0 size-[380px] rounded-full bg-jee/20 blur-[90px]" />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-24">
          <motion.div initial="hidden" animate="show" className="space-y-8">
            <motion.div
              custom={0}
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                JEE · NEET mock infrastructure
              </span>
            </motion.div>

            <motion.h1
              custom={1}
              variants={fadeUp}
              className="font-display text-[clamp(3rem,8vw,5.5rem)] uppercase leading-[0.88] tracking-tighter"
            >
              Train harder.
              <br />
              <span className="text-gradient-primary">Rank higher.</span>
            </motion.h1>

            <motion.p
              custom={2}
              variants={fadeUp}
              className="max-w-xl text-lg leading-relaxed text-muted-foreground"
            >
              Abhyas is the practice engine for coaching institutes and independent aspirants —
              seat-managed org portals, server-graded mocks, and live leaderboards that actually
              move.
            </motion.p>

            <motion.div custom={3} variants={fadeUp} className="flex flex-wrap gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-glow-primary transition-transform hover:scale-[1.02]"
              >
                Open your portal
                <ArrowRight className="size-5" />
              </Link>
              <a
                href="#portals"
                className="inline-flex items-center rounded-2xl border border-border glass-strong px-8 py-4 text-base font-semibold transition-colors hover:border-primary/40"
              >
                Explore product
              </a>
            </motion.div>

            <motion.div custom={4} variants={fadeUp} className="flex flex-wrap gap-3 pt-2">
              <span className="rounded-full border border-jee/30 bg-jee/10 px-3 py-1 font-mono text-xs font-medium text-jee">
                JEE Main mocks
              </span>
              <span className="rounded-full border border-neet/30 bg-neet/10 px-3 py-1 font-mono text-xs font-medium text-neet">
                NEET coming soon
              </span>
            </motion.div>
          </motion.div>

          {/* Hero visual — ranking preview card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
            className="relative"
          >
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-neet/20 blur-2xl" />
            <div className="relative glass-strong overflow-hidden rounded-[1.75rem] border border-white/60 p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Live leaderboard
                  </div>
                  <div className="mt-1 font-display text-3xl uppercase">All India Rank</div>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
                  <LineChart className="size-6 text-primary" />
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { rank: 1, name: "Aarav K.", score: "286", delta: "+41" },
                  { rank: 2, name: "Priya M.", score: "271", delta: "+18" },
                  { rank: 3, name: "You", score: "254", delta: "+62", highlight: true },
                  { rank: 4, name: "Rohan S.", score: "248", delta: "+9" },
                ].map((row) => (
                  <div
                    key={row.rank}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                      row.highlight ? "border border-primary/40 bg-primary/10" : "glass"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xl text-muted-foreground">
                        #{row.rank}
                      </span>
                      <span className="font-semibold">{row.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold">{row.score}</div>
                      <div className="text-[10px] font-medium text-neet">{row.delta}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-5">
                {[
                  { k: "Attempts", v: "26" },
                  { k: "Accuracy", v: "78%" },
                  { k: "Avg marks", v: "230" },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl bg-white/50 px-2 py-3 text-center">
                    <div className="font-mono text-[9px] uppercase text-muted-foreground">
                      {s.k}
                    </div>
                    <div className="font-display text-xl">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border bg-white/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border md:grid-cols-4">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="bg-background px-6 py-8 text-center md:text-left"
            >
              <div className="font-display text-4xl uppercase tracking-tight text-gradient-primary">
                {stat.value}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Three portals */}
      <section id="portals" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-14 max-w-2xl"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              One platform · three doors
            </div>
            <h2 className="mt-3 font-display text-5xl uppercase leading-none tracking-tighter md:text-6xl">
              Every role gets its own cockpit.
            </h2>
          </motion.div>

          <div className="grid gap-5 lg:grid-cols-3">
            {PORTALS.map((portal, i) => (
              <motion.article
                key={portal.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className={`group rounded-3xl border p-7 transition-shadow hover:shadow-xl ${portal.accent}`}
              >
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                    <portal.icon className="size-5 text-foreground" />
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {portal.tag}
                  </span>
                </div>
                <h3 className="font-display text-3xl uppercase">{portal.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{portal.copy}</p>
                <Link
                  to="/login"
                  className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100"
                >
                  Sign in <ArrowRight className="size-4" />
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Exams */}
      <section
        id="exams"
        className="border-y border-border bg-gradient-to-b from-secondary/50 to-background px-6 py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-3xl border-2 border-jee/30 bg-gradient-to-br from-jee/10 to-white p-10"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-jee">
                Available now
              </div>
              <h3 className="mt-3 font-display text-5xl uppercase text-jee">JEE Main</h3>
              <p className="mt-4 max-w-sm text-muted-foreground">
                Full papers plus Physics, Chemistry, and Mathematics drills — timed, graded on the
                server, ranked nationally.
              </p>
              <ul className="mt-8 space-y-2 text-sm font-medium">
                {["All-subject mocks", "Chapter-wise practice", "AIR · State · City boards"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-jee" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-3xl border border-dashed border-neet/40 bg-neet/5 p-10 opacity-90"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-neet">
                Roadmap
              </div>
              <h3 className="mt-3 font-display text-5xl uppercase text-neet">NEET</h3>
              <p className="mt-4 max-w-sm text-muted-foreground">
                Biology-heavy mocks and institute rankings — launching on the same engine as JEE.
              </p>
              <div className="mt-8 inline-flex rounded-full border border-neet/30 px-4 py-2 font-mono text-xs uppercase tracking-widest text-neet">
                Coming soon
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="flow" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              How Abhyas works
            </div>
            <h2 className="mt-3 font-display text-5xl uppercase tracking-tighter md:text-6xl">
              From signup to scoreboard.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-strong relative rounded-3xl p-8"
              >
                <span className="font-display text-6xl text-primary/20">{step.n}</span>
                <h3 className="mt-4 font-display text-2xl uppercase">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features + audiences */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="glass-strong rounded-3xl p-8">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/15">
                <Building2 className="size-6 text-primary" />
              </div>
              <h3 className="font-display text-3xl uppercase">For coaching centers</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Seat pools like 0/450, org admin dashboards, alias logins per subdomain, and
                activity feeds for every student attempt.
              </p>
            </div>
            <div className="glass-strong rounded-3xl p-8">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-neet/15">
                <BarChart3 className="size-6 text-neet" />
              </div>
              <h3 className="font-display text-3xl uppercase">For independent students</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Five free submissions, All India rankings, then a simple monthly plan — no institute
                required to start practicing.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Shield, label: "Server-side grading" },
              { icon: LineChart, label: "Rank movement tracking" },
              { icon: Users, label: "Multi-tenant orgs" },
              { icon: Sparkles, label: "Alias student logins" },
            ].map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 rounded-2xl border border-border/80 bg-white/50 px-4 py-4"
              >
                <f.icon className="size-5 shrink-0 text-primary" />
                <span className="text-sm font-semibold">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-foreground px-8 py-16 text-center text-background md:px-16"
        >
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-primary/40 blur-[80px]" />
          <div className="relative">
            <h2 className="font-display text-5xl uppercase tracking-tighter md:text-6xl">
              Ready to open Abhyas?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-background/70">
              Institutes onboard through the developer portal. Students and admins sign in with one
              URL — your role routes you to the right workspace.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-primary px-10 py-4 text-lg font-bold text-primary-foreground shadow-glow-primary transition-transform hover:scale-[1.02]"
            >
              Get started
              <ArrowRight className="size-5" />
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Link to="/" className="font-display text-xl tracking-tighter text-gradient-primary">
            ABHYAS
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Mock prep · Organizations · Rankings
          </p>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
