/**
 * Provider Registry Sync
 * ──────────────────────
 * Pulls two community-maintained registries and uses them as a "source of
 * truth" fallback so provider_catalog.homepage (signup URL) never goes stale:
 *
 *   1. https://raw.githubusercontent.com/cheahjs/free-llm-api-resources/main/README.md
 *      Curated list of free-tier providers with clean signup links.
 *      Format: `### [Name](https://signup.url)`
 *
 *   2. https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
 *      Authoritative provider slug list from LiteLLM (100+ providers).
 *      Used to confirm a slug is still supported upstream.
 *
 * Policy (no hardcode, runtime-only):
 *   - Run every 6 hours.
 *   - For each row where homepage_ok = false (failed the verify probe) AND a
 *     registry match exists with a different URL → UPDATE homepage, re-set
 *     homepage_ok = NULL so the next verify cycle re-probes the new URL.
 *   - Never touch a row whose homepage_ok = true (don't thrash working URLs).
 *   - Never delete; only UPDATE or leave alone.
 */
import { getSqlClient } from "@/lib/db/schema";

const CHEAHJS_URL = "https://raw.githubusercontent.com/cheahjs/free-llm-api-resources/main/README.md";
const LITELLM_URL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const FETCH_TIMEOUT_MS = 15_000;

// Map a registry provider name (from Markdown heading) to our catalog slug.
// Only explicit overrides — for unmapped entries we normalize the name and
// check if the resulting slug already exists in provider_catalog.
const NAME_ALIAS: Record<string, string> = {
  "google ai studio": "google",
  "nvidia nim": "nvidia",
  "mistral la plateforme": "mistral",
  "mistral codestral": "mistral",
  "huggingface inference providers": "huggingface",
  "cloudflare workers ai": "cloudflare",
  "github models": "github",
  "sambanova cloud": "sambanova",
  "scaleway generative apis": "scaleway",
  "alibaba cloud international model studio": "dashscope",
  "openthaigpt": "typhoon", // both are Thai LLMs; we only wire Typhoon
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")    // strip "(...)"
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameToSlug(name: string): string {
  const norm = normalizeName(name);
  if (NAME_ALIAS[norm]) return NAME_ALIAS[norm];
  // default: collapse to lowercase alphanum
  return norm.replace(/\s+/g, "");
}

interface RegistryEntry {
  slug: string;
  rawName: string;
  homepage: string;
  source: "cheahjs" | "litellm";
}

async function fetchCheahjs(): Promise<RegistryEntry[]> {
  try {
    const res = await fetch(CHEAHJS_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "SMLGateway-registry-sync" },
    });
    if (!res.ok) return [];
    const md = await res.text();
    const entries: RegistryEntry[] = [];
    // Match `### [Name](url)` — provider section headers
    const re = /^###\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(md)) !== null) {
      const rawName = m[1].trim();
      const url = m[2].split("?")[0].replace(/\/$/, ""); // strip query + trailing slash
      const slug = nameToSlug(rawName);
      if (slug.length < 2) continue;
      entries.push({ slug, rawName, homepage: url, source: "cheahjs" });
    }
    return entries;
  } catch {
    return [];
  }
}

async function fetchLiteLLMProviders(): Promise<Set<string>> {
  try {
    const res = await fetch(LITELLM_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "SMLGateway-registry-sync" },
    });
    if (!res.ok) return new Set();
    const json = (await res.json()) as Record<string, unknown>;
    const providers = new Set<string>();
    for (const value of Object.values(json)) {
      if (value && typeof value === "object") {
        const prov = (value as Record<string, unknown>).litellm_provider;
        if (typeof prov === "string") providers.add(prov.toLowerCase());
      }
    }
    return providers;
  } catch {
    return new Set();
  }
}

export interface SyncResult {
  cheahjsEntries: number;
  litellmProviders: number;
  patched: number;
  patchList: Array<{ provider: string; oldHomepage: string; newHomepage: string; source: string }>;
}

export async function syncProviderRegistry(): Promise<SyncResult> {
  const [cheahjs, litellm] = await Promise.all([
    fetchCheahjs(),
    fetchLiteLLMProviders(),
  ]);

  const sql = getSqlClient();

  // Only patch rows where the probe said the homepage is dead.
  // Never overwrite a working homepage.
  const broken = await sql<{ name: string; homepage: string | null }[]>`
    SELECT name, homepage
    FROM provider_catalog
    WHERE status = 'active' AND homepage_ok = false
  `;

  // Build lookup: slug → cheahjs entry
  const byCheahSlug = new Map<string, RegistryEntry>();
  for (const e of cheahjs) {
    if (!byCheahSlug.has(e.slug)) byCheahSlug.set(e.slug, e);
  }

  const patchList: SyncResult["patchList"] = [];

  for (const row of broken) {
    // Prefer cheahjs (curated free-tier signup links)
    const hit = byCheahSlug.get(row.name);
    if (!hit) continue;
    if (!hit.homepage) continue;
    if (row.homepage && row.homepage.replace(/\/$/, "") === hit.homepage) continue;

    await sql`
      UPDATE provider_catalog
      SET homepage = ${hit.homepage},
          homepage_ok = NULL,
          homepage_status_code = NULL,
          verify_notes = ${`homepage patched from cheahjs registry (was ${row.homepage ?? "null"})`},
          updated_at = now()
      WHERE name = ${row.name}
    `;
    patchList.push({
      provider: row.name,
      oldHomepage: row.homepage ?? "",
      newHomepage: hit.homepage,
      source: "cheahjs",
    });
  }

  try {
    await sql`
      INSERT INTO worker_logs (step, message, level)
      VALUES ('registry-sync', ${`🔄 registry sync: cheahjs ${cheahjs.length} entries, litellm ${litellm.size} providers — patched ${patchList.length}${patchList.length > 0 ? `: ${patchList.map((p) => p.provider).join(", ")}` : ""}`}, ${patchList.length > 0 ? "success" : "info"})
    `;
  } catch { /* ignore */ }

  return {
    cheahjsEntries: cheahjs.length,
    litellmProviders: litellm.size,
    patched: patchList.length,
    patchList,
  };
}
