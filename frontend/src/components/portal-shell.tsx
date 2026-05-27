import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = {
  developer: [
    { to: "/developer", label: "Developer" },
    { to: "/student", label: "Student view" },
  ],
  organization_admin: [
    { to: "/admin", label: "Admin" },
    { to: "/student", label: "Student view" },
  ],
  student: [{ to: "/student", label: "Student" }],
} as const;

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const links = profile ? NAV[profile.role] : [];

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100/30 via-transparent to-cyan-100/20 pointer-events-none" />
      <div className="absolute top-20 right-1/4 size-96 bg-blue-200/20 blur-3xl rounded-full pointer-events-none" />
      <header className="sticky top-0 z-50 glass-strong border-b border-border">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link to="/" className="font-display text-2xl tracking-tighter text-gradient-primary">
              ABHYAS
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    location.pathname === link.to
                      ? "text-foreground bg-white/5"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold">{profile.full_name}</div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground">
                  {profile.role.replace("_", " ")}
                </div>
              </div>
            )}
            <button
              onClick={logout}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-[1400px] px-6 py-10">{children}</main>
    </div>
  );
}
