import { Navigate } from "react-router-dom";
import { routeForRole, useAuth, type UserRole } from "@/lib/auth";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { loading, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="glass-strong rounded-2xl px-6 py-4 text-sm text-muted-foreground">
          Loading Abhyas...
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={routeForRole(profile.role)} replace />;
  }

  return <>{children}</>;
}
