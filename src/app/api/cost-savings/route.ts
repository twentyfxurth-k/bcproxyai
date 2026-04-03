import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Pricing per 1M tokens (USD)
const PRICING = {
  gpt4o: { input: 2.5, output: 10 },
  claude: { input: 3, output: 15 },
  qwen: { input: 0.8, output: 2 },
};

const USD_TO_THB = 34.5; // approximate

export async function GET() {
  try {
    const db = getDb();

    // All-time totals
    const allTime = db
      .prepare(
        `SELECT
          COALESCE(SUM(input_tokens), 0) AS total_input,
          COALESCE(SUM(output_tokens), 0) AS total_output
        FROM token_usage`
      )
      .get() as { total_input: number; total_output: number };

    // Today totals
    const today = new Date().toISOString().slice(0, 10);
    const todayUsage = db
      .prepare(
        `SELECT
          COALESCE(SUM(input_tokens), 0) AS total_input,
          COALESCE(SUM(output_tokens), 0) AS total_output
        FROM token_usage
        WHERE created_at >= ?`
      )
      .get(`${today}T00:00:00`) as { total_input: number; total_output: number };

    // Total requests
    const totalRequests = (db.prepare("SELECT COUNT(*) as c FROM token_usage").get() as { c: number }).c;
    const todayRequests = (db.prepare("SELECT COUNT(*) as c FROM token_usage WHERE created_at >= ?").get(`${today}T00:00:00`) as { c: number }).c;

    const calcCost = (input: number, output: number, pricing: { input: number; output: number }) =>
      (input / 1_000_000) * pricing.input + (output / 1_000_000) * pricing.output;

    const costGpt4o = calcCost(allTime.total_input, allTime.total_output, PRICING.gpt4o);
    const costClaude = calcCost(allTime.total_input, allTime.total_output, PRICING.claude);
    const costQwen = calcCost(allTime.total_input, allTime.total_output, PRICING.qwen);

    const todayCostGpt4o = calcCost(todayUsage.total_input, todayUsage.total_output, PRICING.gpt4o);
    const todayCostClaude = calcCost(todayUsage.total_input, todayUsage.total_output, PRICING.claude);
    const todayCostQwen = calcCost(todayUsage.total_input, todayUsage.total_output, PRICING.qwen);

    const totalSaved = Math.max(costGpt4o, costClaude);
    const todaySaved = Math.max(todayCostGpt4o, todayCostClaude);

    const r = (n: number) => Math.round(n * 10000) / 10000;

    return NextResponse.json({
      totalInputTokens: allTime.total_input,
      totalOutputTokens: allTime.total_output,
      totalTokens: allTime.total_input + allTime.total_output,
      totalRequests,
      todayRequests,
      costGpt4o: r(costGpt4o),
      costClaude: r(costClaude),
      costQwen: r(costQwen),
      costGpt4oThb: r(costGpt4o * USD_TO_THB),
      costClaudeThb: r(costClaude * USD_TO_THB),
      costQwenThb: r(costQwen * USD_TO_THB),
      actualCost: 0,
      totalSaved: r(totalSaved),
      totalSavedThb: r(totalSaved * USD_TO_THB),
      todaySaved: r(todaySaved),
      todaySavedThb: r(todaySaved * USD_TO_THB),
      todayCostGpt4o: r(todayCostGpt4o),
      todayCostClaude: r(todayCostClaude),
      todayCostQwen: r(todayCostQwen),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
