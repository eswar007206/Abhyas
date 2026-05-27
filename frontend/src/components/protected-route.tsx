import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import type { UserRole } from "@/lib/auth-types";
import { routeForRole } from "@/lib/route-for-role";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="glass-strong rounded-2xl px-6 py-4 text-sm text-muted-foreground">
          Loading Abhyas...
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-6">
        <div className="max-w-md rounded-2xl glass-strong p-6 text-center">
          <div className="font-semibold">Profile not ready</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account exists but the profile record is missing or still syncing. Try signing in
            again or contact support.
          </p>
        </div>
      </div>
    );
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={routeForRole(profile.role)} replace />;
  }

  return <>{children}</>;
}
