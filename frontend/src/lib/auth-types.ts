export type UserRole = "developer" | "organization_admin" | "student";
export type AccountType = "independent" | "organization";
export type SubscriptionStatus = "free" | "trialing" | "active" | "past_due" | "cancelled";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  account_type: AccountType;
  organization_id: string | null;
  free_test_limit: number;
  subscription_status: SubscriptionStatus;
  last_seen_at: string | null;
  state: string | null;
  city: string | null;
}
