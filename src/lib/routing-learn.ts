import { getSqlClient } from "@/lib/db/schema";

/**
 * Prompt categories for smart routing
 * Detects what kind of prompt the user sent
 */
const CATEGORY_PATTERNS: [string, RegExp[]][] = [
  ["code", [/```/, /function\s/, /class\s/, /import\s/, /const\s/, /def\s/, /console\.log/, /return\s/, /เขียนโค้ด/i, /write.*code/i]],
  ["thai", [/[\u0E00-\u0E7F]{3,}/]],
  ["math", [/\d+\s*[\+\-\*\/\=]\s*\d+/, /equation/, /calculate/, /formula/i, /คำนวณ/, /สมการ/]],
  ["creative", [/write\s+a\s+(story|poem|song)/i, /creative/i, /imagine/i, /fiction/i, /แต่ง/, /กลอน/, /นิทาน/]],
  ["instruction", [/json/i, /format/i, /ตอบเป็น/, /ตามรูปแบบ/]],
  ["knowledge", [/อธิบาย/, /explain/i, /what\s+is/i, /คืออะไร/]],
  ["vision", [/ดูรูป/, /ภาพนี้/, /รูปนี้/, /image/i, /picture/i, /photo/i]],
  ["analysis", [/analyze/i, /compare/i, /evaluate/i, /pros\s+and\s+cons/i, /summarize/i, /summary/i, /วิเคราะห์/, /เปรียบเทียบ/]],
  ["translate", [/translate/i, /แปล/]],
];

export function detectPromptCategory(userMessage: string): string {
  if (!userMessage) return "general";
  for (const [cat, patterns] of CATEGORY_PATTERNS) {
    for (const p of patterns) {
      if (p.test(userMessage)) return cat;
    }
  }
  return "general";
}

/**
 * Record a routing result for learning
 */
export async function recordRoutingResult(
  modelId: string,
  provider: string,
  promptCategory: string,
  success: boolean,
  latencyMs: number
): Promise<void> {
  try {
    const sql = getSqlClient();
    await sql`
      INSERT INTO routing_stats (model_id, provider, prompt_category, success, latency_ms)
      VALUES (${modelId}, ${provider}, ${promptCategory}, ${success ? 1 : 0}, ${latencyMs})
    `;
  } catch { /* non-critical */ }
}

/**
 * Get best models for a given prompt category
 * Returns model IDs sorted by success rate * inverse latency
 */
export async function getBestModelsForCategory(promptCategory: string): Promise<string[]> {
  try {
    const sql = getSqlClient();
    const rows = await sql<{ model_id: string }[]>`
      SELECT model_id,
        COUNT(*) as total,
        SUM(success) as successes,
        AVG(latency_ms) as avg_lat,
        CAST(SUM(success) AS REAL) / COUNT(*) as success_rate
      FROM routing_stats
      WHERE prompt_category = ${promptCategory}
        AND created_at >= now() - interval '7 days'
      GROUP BY model_id
      HAVING COUNT(*) >= 3
      ORDER BY success_rate DESC, avg_lat ASC
      LIMIT 10
    `;
    return rows.map(r => r.model_id);
  } catch {
    return [];
  }
}

/**
 * Get models ranked by benchmark score for a specific category
 * Used to prioritize models that are strong in the requested area
 */
export async function getBestModelsByBenchmarkCategory(category: string): Promise<string[]> {
  try {
    const sql = getSqlClient();
    const rows = await sql<{ model_id: string }[]>`
      SELECT model_id, AVG(score) as avg_score, COUNT(*) as q_count
      FROM benchmark_results
      WHERE category = ${category}
      GROUP BY model_id
      HAVING COUNT(*) >= 1 AND AVG(score) >= 5
      ORDER BY avg_score DESC
      LIMIT 20
    `;
    return rows.map(r => r.model_id);
  } catch {
    return [];
  }
}

/**
 * Emit a system event (School Bell)
 */
export async function emitEvent(
  type: string,
  title: string,
  detail?: string,
  provider?: string,
  modelId?: string,
  severity: "info" | "warn" | "error" | "success" = "info"
): Promise<void> {
  try {
    const sql = getSqlClient();
    await sql`
      INSERT INTO events (type, title, detail, provider, model_id, severity)
      VALUES (${type}, ${title}, ${detail ?? null}, ${provider ?? null}, ${modelId ?? null}, ${severity})
    `;
  } catch { /* non-critical */ }
}
