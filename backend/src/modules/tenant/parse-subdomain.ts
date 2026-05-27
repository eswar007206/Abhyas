const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function parseSubdomainFromHost(
  hostHeader: string | undefined,
  platformRootDomain: string,
): string | null {
  if (!hostHeader) return null;

  const host = hostHeader.split(":")[0]?.trim().toLowerCase();
  if (!host || LOCAL_HOSTS.has(host)) return null;

  const root = platformRootDomain.trim().toLowerCase();
  if (!root) return null;

  if (host === root || host === `www.${root}`) return null;

  if (host.endsWith(`.${root}`)) {
    const subdomain = host.slice(0, -(root.length + 1));
    if (!subdomain || subdomain.includes(".")) return null;
    return subdomain;
  }

  return null;
}

export function parseSubdomainFromAliasEmail(
  email: string,
  platformRootDomain: string,
): { subdomain: string; aliasLocal: string } | null {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0) return null;

  const aliasLocal = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const root = platformRootDomain.trim().toLowerCase();
  if (!aliasLocal || !domain.endsWith(`.${root}`)) return null;

  const subdomain = domain.slice(0, -(root.length + 1));
  if (!subdomain || subdomain.includes(".")) return null;

  return { subdomain, aliasLocal };
}
