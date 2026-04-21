import { NextResponse } from "next/server";
import { getPerfCounts } from "@/lib/perf-counters";
import { getSqlClient } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

interface PerfInsights {
  windowHours: number;
  counts: Record<string, number>;
  rates: {
    cacheHitRate: number;       // 0..1
    hedgeWinRate: number;        // of non-cache successes
    speculativeWinRate: number;  // wins / fires
    stickyPinRate: number;       // hits per request
  };
  // Top-level Dashboard stats (1h rolling)
  requestsLastHour: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
}

export async function GET() {
  try {
    const counts = await getPerfCounts();
    const sql = getSqlClient();
    const stats = await sql<{
      total: number; errors: number; avg_ms: number; p50: number; p95: number;
    }[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status >= 400)::int AS errors,
        COALESCE(AVG(latency_ms), 0)::int AS avg_ms,
        COALESCE(percentile_cont(0.5)  WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p50,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p95
      FROM gateway_logs
      WHERE created_at > now() - interval '1 hour'
    `;
    const s = stats[0] ?? { total: 0, errors: 0, avg_ms: 0, p50: 0, p95: 0 };

    const cacheHits = counts["cache:hit"] ?? 0;
    const cacheMisses = counts["cache:miss"] ?? 0;
    const hedgeWins = counts["hedge:win"] ?? 0;
    const hedgeLoss = counts["hedge:loss"] ?? 0;
    const specFires = counts["spec:fire"] ?? 0;
    const specWins = counts["spec:win"] ?? 0;
    const stickyHits = counts["sticky:hit"] ?? 0;

    const totalReqs = s.total;
    const cacheTotal = cacheHits + cacheMisses;
    const hedgeTotal = hedgeWins + hedgeLoss;

    const result: PerfInsights = {
      windowHours: 1,
      counts,
      rates: {
        cacheHitRate: cacheTotal > 0 ? cacheHits / cacheTotal : 0,
        hedgeWinRate: hedgeTotal > 0 ? hedgeWins / hedgeTotal : 0,
        speculativeWinRate: specFires > 0 ? specWins / specFires : 0,
        stickyPinRate: totalReqs > 0 ? stickyHits / totalReqs : 0,
      },
      requestsLastHour: totalReqs,
      avgLatencyMs: s.avg_ms,
      p50LatencyMs: s.p50,
      p95LatencyMs: s.p95,
      errorRate: totalReqs > 0 ? s.errors / totalReqs : 0,
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  }
}
