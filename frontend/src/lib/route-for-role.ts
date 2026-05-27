import type { UserRole } from "@/lib/auth-types";

export function routeForRole(role: UserRole) {
  if (role === "developer") return "/developer";
  if (role === "organization_admin") return "/admin";
  return "/student";
}
