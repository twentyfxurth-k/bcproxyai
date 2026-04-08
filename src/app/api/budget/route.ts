import { NextRequest, NextResponse } from "next/server";
import { getSqlClient } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getSqlClient();

    const configRows = await sql<{ value: string }[]>`
      SELECT value FROM budget_config WHERE key = 'daily_token_limit'
    `;
    const dailyLimit = configRows.length > 0 ? Number(configRows[0].value) : 1000000;

    const today = new Date().toISOString().slice(0, 10);
    const usageRows = await sql<{
      input_tokens: number; output_tokens: number;
      total_tokens: number; estimated_cost_usd: number;
    }[]>`
      SELECT
        COALESCE(SUM(input_tokens), 0) AS input_tokens,
        COALESCE(SUM(output_tokens), 0) AS output_tokens,
        COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
        COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd
      FROM token_usage
      WHERE created_at >= ${today + 'T00:00:00'}::timestamptz
    `;
    const usage = usageRows[0] ?? { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 };

    const percentUsed = dailyLimit > 0 ? (Number(usage.total_tokens) / dailyLimit) * 100 : 0;

    return NextResponse.json({
      dailyLimit,
      todayUsage: Number(usage.total_tokens),
      todayInputTokens: Number(usage.input_tokens),
      todayOutputTokens: Number(usage.output_tokens),
      estimatedCostUsd: Number(usage.estimated_cost_usd),
      percentUsed: Math.round(percentUsed * 100) / 100,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dailyLimit } = body as { dailyLimit?: number };

    if (dailyLimit == null || dailyLimit < 0) {
      return NextResponse.json({ error: "dailyLimit must be a non-negative number" }, { status: 400 });
    }

    const sql = getSqlClient();
    await sql`
      INSERT INTO budget_config (key, value) VALUES ('daily_token_limit', ${String(dailyLimit)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;

    return NextResponse.json({ ok: true, dailyLimit });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
