import { createClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config/env.js";

export function createSupabaseAdmin(config: AppConfig) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
