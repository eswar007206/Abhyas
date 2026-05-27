import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

function resolveBackendRoot(): string {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(resolve(current, ".env.example"))) {
      return current;
    }
    current = resolve(current, "..");
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

const backendRoot = resolveBackendRoot();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  PLATFORM_ROOT_DOMAIN: z.string().min(1).default("abhyas.in"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let envFilesLoaded = false;

/** Load `backend/.env` then `.env.local` into process.env (skipped in test). */
export function loadEnvFiles(): void {
  if (envFilesLoaded || process.env.NODE_ENV === "test") {
    return;
  }

  envFilesLoaded = true;

  const candidates = [resolve(backendRoot, ".env"), resolve(backendRoot, ".env.local")];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const result = loadDotenv({ path, quiet: true });
    if (result.error) {
      throw new Error(`Failed to load environment file ${path}: ${result.error.message}`);
    }
  }
}

function envFileHint(): string {
  const envPath = resolve(backendRoot, ".env");
  if (!existsSync(envPath)) {
    return "Run: npm run env:init  (creates backend/.env from .env.example)";
  }
  if (statSync(envPath).size === 0) {
    return [
      "backend/.env exists but is empty (0 bytes).",
      "If you edited .env in the editor, save the file (Ctrl+S), then run npm run dev again.",
      "Or run: npm run env:init",
    ].join("\n");
  }
  return "Check backend/.env — required keys must be set (not placeholders).";
}

function formatConfigError(error: z.ZodError): string {
  const missing = error.issues
    .filter((issue) => issue.code === "invalid_type" && issue.received === "undefined")
    .map((issue) => issue.path.join("."));

  if (missing.length > 0) {
    return [
      "Missing required environment variables:",
      ...missing.map((name) => `  - ${name}`),
      "",
      envFileHint(),
      "Supabase keys: https://supabase.com/dashboard/project/_/settings/api",
    ].join("\n");
  }

  return error.message;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  loadEnvFiles();

  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(formatConfigError(result.error));
  }

  return result.data;
}
