import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { routeForRole } from "@/lib/route-for-role";

export default function LoginPage() {
  const { loading, profile, signIn, signUpStudent } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && profile) {
    return <Navigate to={routeForRole(profile.role)} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      if (mode === "signup") {
        await signUpStudent(fullName, email, password, state, city);
        setMessage("Account created. Check your email if confirmation is enabled, then sign in.");
        setMode("login");
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="dark hidden lg:flex relative overflow-hidden bg-background p-12 flex-col justify-between">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-20 -left-20 size-[500px] bg-primary/30 blur-[140px] rounded-full" />
        <Link
          to="/"
          className="relative font-display text-3xl tracking-tighter text-gradient-primary"
        >
          ABHYAS
        </Link>
        <div className="relative space-y-6">
          <h1 className="font-display text-6xl uppercase leading-none">
            One login for every portal.
          </h1>
          <p className="max-w-md text-muted-foreground">
            Developer, organization admin, and student access share one login URL. Your role routes
            you to the correct workspace after sign-in.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="lg:hidden mb-10 block font-display text-2xl tracking-tighter text-gradient-primary"
          >
            ABHYAS
          </Link>
          <div className="mb-8">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Abhyas Access
            </div>
            <h2 className="mt-2 font-display text-4xl uppercase">
              {mode === "login" ? "Sign in" : "Create student account"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Organization students use credentials from their coaching center (e.g.{" "}
              <span className="font-mono">rollno@institute.abhyas.in</span>). Org admins may use{" "}
              <span className="font-mono">admin@institute.abhyas.in</span>. Independent students can
              sign up free.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl glass p-1">
            <button
              onClick={() => setMode("login")}
              className={`rounded-xl py-2 text-sm font-semibold ${mode === "login" ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              Login
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`rounded-xl py-2 text-sm font-semibold ${mode === "signup" ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              Student signup
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Full name
                  </span>
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full glass rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      State
                    </span>
                    <input
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Andhra Pradesh"
                      className="w-full glass rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      City
                    </span>
                    <input
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Bangalore"
                      className="w-full glass rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </label>
                </div>
              </>
            )}
            <label className="block">
              <span className="mb-2 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Email
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full glass rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Password
              </span>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl border border-neet/40 bg-neet/10 px-4 py-3 text-sm text-neet">
                {message}
              </div>
            )}

            <button
              disabled={submitting}
              type="submit"
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:shadow-glow-primary transition-all disabled:opacity-60"
            >
              {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create free account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
