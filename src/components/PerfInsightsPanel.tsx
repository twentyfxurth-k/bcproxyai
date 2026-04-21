"use client";

import { useEffect, useState } from "react";

interface PerfInsights {
  windowHours: number;
  counts: Record<string, number>;
  rates: {
    cacheHitRate: number;
    hedgeWinRate: number;
    speculativeWinRate: number;
    stickyPinRate: number;
  };
  requestsLastHour: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

function fmtMs(v: number): string {
  if (v < 1000) return `${v}ms`;
  return `${(v / 1000).toFixed(1)}s`;
}

function StatCard({
  emoji, label, value, subtext, color,
}: {
  emoji: string; label: string; value: string; subtext?: string; color: string;
}) {
  return (
    <div className={`rounded-xl border ${color} p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="text-base">{emoji}</span>
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtext && <div className="text-xs text-gray-500">{subtext}</div>}
    </div>
  );
}

export function PerfInsightsPanel() {
  const [data, setData] = useState<PerfInsights | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/perf-insights");
        if (!res.ok) return;
        const json = await res.json() as PerfInsights;
        setData(json);
      } catch { /* silent */ }
    };
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return (
      <div className="glass rounded-2xl p-6 border border-indigo-500/15 text-sm text-gray-400">
        กำลังโหลดตัวชี้วัดประสิทธิภาพ...
      </div>
    );
  }

  const c = data.counts;

  return (
    <div className="glass rounded-2xl p-6 border border-indigo-500/15 space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-3xl">⚡</span>
        <div>
          <h2 className="text-2xl font-bold text-white">ประสิทธิภาพ (1 ชม.ล่าสุด)</h2>
          <p className="text-xs text-gray-500">
            {data.requestsLastHour} requests · avg {fmtMs(data.avgLatencyMs)} · p50 {fmtMs(data.p50LatencyMs)} · p95 {fmtMs(data.p95LatencyMs)} · error {fmtPct(data.errorRate)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard
          emoji="💾"
          label="Cache HIT rate"
          value={fmtPct(data.rates.cacheHitRate)}
          subtext={`${c["cache:hit"] ?? 0} hits / ${(c["cache:hit"] ?? 0) + (c["cache:miss"] ?? 0)} total`}
          color="border-emerald-500/30 bg-emerald-500/5"
        />
        <StatCard
          emoji="🏁"
          label="Hedge WIN rate"
          value={fmtPct(data.rates.hedgeWinRate)}
          subtext={`${c["hedge:win"] ?? 0} wins / ${(c["hedge:win"] ?? 0) + (c["hedge:loss"] ?? 0)} tries`}
          color="border-cyan-500/30 bg-cyan-500/5"
        />
        <StatCard
          emoji="⚡"
          label="Speculative WIN"
          value={c["spec:fire"] && c["spec:fire"] > 0 ? fmtPct(data.rates.speculativeWinRate) : "—"}
          subtext={`${c["spec:fire"] ?? 0} fires · ${c["spec:win"] ?? 0} wins`}
          color="border-violet-500/30 bg-violet-500/5"
        />
        <StatCard
          emoji="📌"
          label="Sticky pinned"
          value={`${c["sticky:hit"] ?? 0}`}
          subtext={`${fmtPct(data.rates.stickyPinRate)} of requests`}
          color="border-indigo-500/30 bg-indigo-500/5"
        />
        <StatCard
          emoji="🚫"
          label="Provider demoted"
          value={`${c["demote:rate-limit"] ?? 0}`}
          subtext="auto-cooldown from 429 storm"
          color="border-amber-500/30 bg-amber-500/5"
        />
        <StatCard
          emoji="📈"
          label="p50 latency"
          value={fmtMs(data.p50LatencyMs)}
          subtext={`p95 ${fmtMs(data.p95LatencyMs)}`}
          color="border-teal-500/30 bg-teal-500/5"
        />
        <StatCard
          emoji="📊"
          label="Throughput"
          value={`${data.requestsLastHour}`}
          subtext="req / hour"
          color="border-blue-500/30 bg-blue-500/5"
        />
        <StatCard
          emoji={data.errorRate < 0.05 ? "✅" : "⚠️"}
          label="Error rate"
          value={fmtPct(data.errorRate)}
          subtext={data.errorRate < 0.05 ? "healthy" : "check providers"}
          color={data.errorRate < 0.05 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}
        />
      </div>
    </div>
  );
}
