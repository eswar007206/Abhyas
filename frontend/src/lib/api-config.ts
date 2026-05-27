/** Backend base URL; unset means admin/org API routes are unavailable in the UI. */
export function getApiUrl(): string | null {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.replace(/\/$/, "") : null;
}

export function isBackendApiEnabled(): boolean {
  return getApiUrl() !== null;
}
