import { createClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config/env.js";

/** Publishable-key client for password sign-in (never use service role for login). */
export function createSupabaseAuthClient(config: AppConfig) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
