/** Client-side validators (mirror backend Zod rules; avoid HTML `pattern` — breaks under RegExp /v). */

const ALIAS_LOCAL_RE = /^[-a-z0-9._]{2,64}$/;
const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function validateAliasLocal(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (!ALIAS_LOCAL_RE.test(trimmed)) {
    return "Alias must be 2–64 characters: lowercase letters, numbers, dots, underscores, hyphens.";
  }
  return null;
}

export function validateSubdomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length < 2 || trimmed.length > 63) {
    return "Subdomain must be 2–63 characters.";
  }
  if (!SUBDOMAIN_RE.test(trimmed)) {
    return "Use lowercase letters, numbers, and hyphens (not at the start or end).";
  }
  return null;
}
