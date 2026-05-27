import { copyFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(backendRoot, ".env");
const examplePath = resolve(backendRoot, ".env.example");

function isEmptyFile(path: string): boolean {
  if (!existsSync(path)) return true;
  return statSync(path).size === 0;
}

if (!isEmptyFile(envPath)) {
  console.log("backend/.env already exists with content — no changes made.");
  process.exit(0);
}

copyFileSync(examplePath, envPath);
console.log("Created backend/.env from .env.example.");
console.log(
  "Edit backend/.env and set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY from:",
);
console.log("https://supabase.com/dashboard/project/_/settings/api");
