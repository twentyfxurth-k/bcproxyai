/**
 * Admin email parser
 * ──────────────────
 * Reads `AUTH_OWNER_EMAIL` as a comma- or whitespace-separated list so
 * multiple Google accounts can share owner privileges. Backwards-compatible
 * with a single-email value.
 *
 *   AUTH_OWNER_EMAIL=alice@acme.com
 *   AUTH_OWNER_EMAIL=alice@acme.com,bob@acme.com
 *   AUTH_OWNER_EMAIL="alice@acme.com bob@acme.com  carol@acme.com"
 *
 * Empty / unset → no owners → local mode (auth disabled).
 */

let cachedRaw: string | undefined;
let cachedSet: Set<string> = new Set();

function parse(): Set<string> {
  const raw = process.env.AUTH_OWNER_EMAIL ?? "";
  if (raw === cachedRaw) return cachedSet;
  cachedRaw = raw;
  cachedSet = new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && s.includes("@")),
  );
  return cachedSet;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parse().has(email.toLowerCase());
}

export function hasOwners(): boolean {
  return parse().size > 0;
}

export function listOwners(): string[] {
  return [...parse()];
}
