import { NextRequest, NextResponse } from "next/server";
import { getSqlClient } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Source of truth: provider_catalog.models_url + .auth_scheme (+ .auth_header_name)
// No hardcoded table here — adding a provider = INSERT into DB, not editing this file.
interface CatalogRow {
  name: string;
  models_url: string | null;
  auth_scheme: string | null;
  auth_header_name: string | null;
}

export async function POST(req: NextRequest) {
  const { provider, apiKey } = await req.json();
  if (!provider || typeof provider !== "string") {
    return NextResponse.json({ ok: false, error: "Missing provider" }, { status: 400 });
  }

  const sql = getSqlClient();
  const rows = await sql<CatalogRow[]>`
    SELECT name, models_url, auth_scheme, auth_header_name
    FROM provider_catalog
    WHERE name = ${provider}
    LIMIT 1
  `;
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: `Provider not in catalog: ${provider}` }, { status: 404 });
  }
  const cfg = rows[0];

  // Cloudflare needs account id baked into URL — allow a runtime template
  let url = cfg.models_url ?? "";
  if (!url && provider === "cloudflare") {
    const acct = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    if (!acct) return NextResponse.json({ ok: false, error: "CLOUDFLARE_ACCOUNT_ID not set" });
    url = `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/models/search?task=Text+Generation`;
  }
  if (!url) {
    return NextResponse.json({
      ok: false,
      error: "No models_url configured for this provider — run verify worker or set it in provider_catalog.",
    });
  }

  const scheme = (cfg.auth_scheme ?? "bearer") as "bearer" | "query-key" | "none" | "apikey-header";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (scheme === "bearer") headers["Authorization"] = `Bearer ${apiKey}`;
  else if (scheme === "apikey-header") headers[cfg.auth_header_name ?? "apikey"] = apiKey;
  else if (scheme === "query-key") {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}key=${encodeURIComponent(apiKey)}`;
  }
  // scheme === "none" → no auth added

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({
        ok: false,
        error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      });
    }

    const json = await res.json().catch(() => ({}));
    const models =
      (Array.isArray(json.data) ? json.data.length : 0) ||
      (Array.isArray(json.models) ? json.models.length : 0) ||
      (Array.isArray(json.result) ? json.result.length : 0) ||
      (Array.isArray(json) ? json.length : 0);

    return NextResponse.json({ ok: true, models });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 200) });
  }
}
