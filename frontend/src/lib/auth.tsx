import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUpStudent: (
    fullName: string,
    email: string,
    password: string,
    state?: string,
    city?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function routeForRole(role: UserRole) {
  if (role === "developer") return "/developer";
  if (role === "organization_admin") return "/admin";
  return "/student";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) throw error;
    setProfile(data as Profile);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    await loadProfile(session.user.id);
  }, [loadProfile, session?.user]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        try {
          await loadProfile(data.session.user.id);
        } catch {
          setProfile(null);
        }
      }
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      loadProfile(nextSession.user.id)
        .catch(() => setProfile(null))
        .finally(() => setLoading(false));
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpStudent = async (
    fullName: string,
    email: string,
    password: string,
    state?: string,
    city?: string,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, state, city },
      },
    });
    if (error) throw error;

    if (data.user) {
      await supabase
        .from("profiles")
        .update({ state: state || null, city: city || null })
        .eq("id", data.user.id);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signUpStudent,
      signOut,
      refreshProfile,
    }),
    [loading, profile, refreshProfile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider.");
  return ctx;
}
