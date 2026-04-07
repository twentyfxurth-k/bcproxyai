"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ───────────────────────────────────────────────────────────────
// Live Mascot Theater
// Reads real activity from /api/gateway-logs (สมุดจดงาน)
// and turns each event into an animated cartoon scene
// starring น้องกุ้ง 🦐 + OpenClaw 🦞
// ───────────────────────────────────────────────────────────────

interface GatewayLog {
  id: number;
  provider: string;
  resolvedModel: string | null;
  status: number;
  latencyMs: number;
  error: string | null;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
}

type SceneKind = "idle" | "thinking" | "win" | "slow" | "fail" | "epic" | "study";

interface Scene {
  kind: SceneKind;
  provider: string;
  model: string;
  latencyMs: number;
  caption: string;
  bg: string;
}

const PROVIDER_HEX: Record<string, string> = {
  openrouter: "#3b82f6", kilo: "#a855f7", google: "#34d399", groq: "#fb923c",
  cerebras: "#f43e5e", sambanova: "#14b8a6", mistral: "#38bdf8", ollama: "#84cc16",
};

const SHORT_PROVIDER: Record<string, string> = {
  openrouter: "OpenRouter", groq: "Groq", cerebras: "Cerebras",
  mistral: "Mistral", sambanova: "SambaNova", ollama: "Ollama", google: "Google",
};

function pickScene(log: GatewayLog): Scene {
  const provider = log.provider || "?";
  const model = log.resolvedModel ?? "?";
  const latencyMs = log.latencyMs ?? 0;
  const ok = log.status >= 200 && log.status < 300 && !log.error;
  const display = SHORT_PROVIDER[provider] ?? provider;

  if (!ok) {
    return {
      kind: "fail",
      provider, model, latencyMs,
      caption: `😭 ${display} สอบตก! (${log.status || "error"})`,
      bg: "from-rose-600/30 via-red-700/20 to-rose-900/30",
    };
  }
  if (latencyMs <= 1500) {
    return {
      kind: "epic",
      provider, model, latencyMs,
      caption: `🚀 ${display} ตอบเร็วเหมือนจรวด! (${(latencyMs / 1000).toFixed(1)}s)`,
      bg: "from-emerald-500/30 via-yellow-400/20 to-amber-500/30",
    };
  }
  if (latencyMs <= 4000) {
    return {
      kind: "win",
      provider, model, latencyMs,
      caption: `🏆 ${display} ทำเสร็จเรียบร้อย! (${(latencyMs / 1000).toFixed(1)}s)`,
      bg: "from-emerald-500/25 via-cyan-500/15 to-teal-500/25",
    };
  }
  if (latencyMs <= 10000) {
    return {
      kind: "thinking",
      provider, model, latencyMs,
      caption: `🤔 ${display} กำลังคิดหนัก... (${(latencyMs / 1000).toFixed(1)}s)`,
      bg: "from-sky-500/25 via-indigo-500/15 to-violet-500/25",
    };
  }
  return {
    kind: "slow",
    provider, model, latencyMs,
    caption: `😴 ${display} ใช้เวลานาน ${(latencyMs / 1000).toFixed(1)}s`,
    bg: "from-orange-500/25 via-amber-600/15 to-yellow-700/25",
  };
}

const IDLE_SCENE: Scene = {
  kind: "idle",
  provider: "",
  model: "",
  latencyMs: 0,
  caption: "🦐 น้องกุ้งกับ 🦞 OpenClaw นั่งรอเด็กมาส่งการบ้าน...",
  bg: "from-indigo-500/20 via-purple-500/10 to-cyan-500/20",
};

// Render the cartoon character set for each scene kind
function SceneCharacters({ scene }: { scene: Scene }) {
  const hex = PROVIDER_HEX[scene.provider] ?? "#a855f7";

  switch (scene.kind) {
    case "epic":
      return (
        <div className="flex items-end gap-4 text-6xl">
          <span className="animate-bob">🦐</span>
          <span className="text-5xl animate-spin-slow">🚀</span>
          <span className="animate-bob" style={{ animationDelay: "0.2s" }}>🦞</span>
          <span className="text-4xl animate-float-up">⚡</span>
          <span className="text-4xl animate-float-up" style={{ animationDelay: "0.3s" }}>✨</span>
          <span className="text-4xl animate-float-up" style={{ animationDelay: "0.6s" }}>🎉</span>
        </div>
      );
    case "win":
      return (
        <div className="flex items-end gap-4 text-6xl">
          <span className="animate-bob">🦐</span>
          <span className="text-5xl animate-wiggle">🏆</span>
          <span className="animate-bob" style={{ animationDelay: "0.15s" }}>🦞</span>
          <span className="text-3xl animate-float-up">✨</span>
        </div>
      );
    case "thinking":
      return (
        <div className="flex items-end gap-4 text-6xl">
          <span className="animate-wiggle">🦐</span>
          <span className="text-5xl animate-bob">🤔</span>
          <span className="text-4xl animate-float-up">💭</span>
          <span className="animate-wiggle" style={{ animationDelay: "0.2s" }}>🦞</span>
        </div>
      );
    case "slow":
      return (
        <div className="flex items-end gap-4 text-6xl">
          <span className="animate-bob">🦐</span>
          <span className="text-5xl animate-bob" style={{ animationDelay: "0.4s" }}>😴</span>
          <span className="text-4xl animate-float-up">💤</span>
          <span className="animate-bob" style={{ animationDelay: "0.8s" }}>🦞</span>
        </div>
      );
    case "fail":
      return (
        <div className="flex items-end gap-4 text-6xl">
          <span className="animate-shake">🦐</span>
          <span className="text-5xl animate-shake">❌</span>
          <span className="text-5xl animate-shake">😭</span>
          <span className="text-4xl animate-float-up">💧</span>
          <span className="text-4xl animate-float-up" style={{ animationDelay: "0.3s" }}>💧</span>
        </div>
      );
    case "study":
      return (
        <div className="flex items-end gap-4 text-6xl">
          <span className="animate-wiggle">🦐</span>
          <span className="text-5xl animate-bob">📚</span>
          <span className="text-4xl animate-float-up">💡</span>
          <span className="animate-bob" style={{ animationDelay: "0.2s" }}>🦞</span>
        </div>
      );
    case "idle":
    default:
      return (
        <div className="flex items-end gap-6 text-6xl">
          <span className="animate-bob">🦐</span>
          <span className="text-5xl animate-bob" style={{ animationDelay: "0.3s" }}>📖</span>
          <span className="animate-bob" style={{ animationDelay: "0.6s" }}>🦞</span>
        </div>
      );
  }
  // Provider color hint (used by ring around badge later if we need it)
  void hex;
}

// Stat badge with count-up
function useCountUp(target: number, duration = 800): number {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (target === prev.current) return;
    const start = performance.now();
    const from = prev.current;
    let raf = 0;
    const tick = (t: number) => {
      const pct = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - pct, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (pct < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Confetti particle layer — only renders when scene.kind is win/epic
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map(i => {
        const left = (i * 7 + 5) % 100;
        const delay = (i * 80) % 1500;
        const dur = 1800 + (i * 90) % 800;
        const colors = ["#fb923c", "#34d399", "#3b82f6", "#f43e5e", "#a855f7", "#facc15"];
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            className="absolute top-0 text-sm animate-confetti"
            style={{
              left: `${left}%`,
              color,
              animationDelay: `${delay}ms`,
              animationDuration: `${dur}ms`,
            }}
          >
            {i % 3 === 0 ? "✦" : i % 3 === 1 ? "●" : "▲"}
          </span>
        );
      })}
    </div>
  );
}

// Tear-rain layer for fail scenes
function TearRain({ active }: { active: boolean }) {
  if (!active) return null;
  const drops = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {drops.map(i => {
        const left = (i * 9 + 3) % 100;
        const delay = (i * 130) % 1500;
        return (
          <span
            key={i}
            className="absolute top-0 text-xs text-sky-400 animate-confetti"
            style={{ left: `${left}%`, animationDelay: `${delay}ms`, animationDuration: "1500ms" }}
          >
            💧
          </span>
        );
      })}
    </div>
  );
}

export function MascotScene() {
  const [logs, setLogs] = useState<GatewayLog[]>([]);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  // Poll real logs every 5 seconds
  useEffect(() => {
    let alive = true;
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/gateway-logs?limit=12");
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (alive && Array.isArray(data.logs)) setLogs(data.logs);
      } catch { /* silent */ }
    };
    fetchLogs();
    const t = window.setInterval(fetchLogs, 5000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);

  // Build scene queue from real logs
  const scenes = useMemo<Scene[]>(() => {
    if (logs.length === 0) return [IDLE_SCENE];
    return logs.slice(0, 8).map(pickScene);
  }, [logs]);

  // Cycle through scenes every 4.5s (unless paused)
  useEffect(() => {
    if (paused || scenes.length <= 1) return;
    const t = window.setInterval(() => {
      setSceneIdx(i => (i + 1) % scenes.length);
    }, 4500);
    return () => window.clearInterval(t);
  }, [paused, scenes.length]);

  // Reset index when scene list changes shape
  useEffect(() => {
    if (sceneIdx >= scenes.length) setSceneIdx(0);
  }, [scenes.length, sceneIdx]);

  const scene = scenes[sceneIdx] ?? IDLE_SCENE;

  // Today's stats from logs (rough — uses fetched window only)
  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter(l => l.status >= 200 && l.status < 300 && !l.error).length;
    const fail = total - success;
    const avgLatency =
      total > 0 ? Math.round(logs.reduce((a, b) => a + (b.latencyMs ?? 0), 0) / total) : 0;
    // Top provider by count
    const counts = new Map<string, number>();
    for (const l of logs) counts.set(l.provider, (counts.get(l.provider) ?? 0) + 1);
    let top = "—"; let topN = 0;
    for (const [p, n] of counts) if (n > topN) { top = p; topN = n; }
    return { total, success, fail, avgLatency, top };
  }, [logs]);

  const animTotal = useCountUp(stats.total);
  const animSuccess = useCountUp(stats.success);
  const animFail = useCountUp(stats.fail);

  return (
    <div className="space-y-3">
      {/* Stage */}
      <div
        className={`relative h-44 sm:h-52 rounded-2xl overflow-hidden glass border border-white/10 bg-gradient-to-br ${scene.bg} cursor-pointer select-none transition-colors duration-700`}
        onClick={() => setSceneIdx(i => (i + 1) % Math.max(scenes.length, 1))}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        title="คลิกเพื่อเปลี่ยนฉาก · hover เพื่อหยุด"
      >
        {/* Live indicator */}
        <div className="absolute top-3 left-4 flex items-center gap-2 text-[10px] text-gray-300 z-10">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          <span className="font-bold uppercase tracking-wider">LIVE · จากสมุดจดงาน</span>
        </div>

        {/* Background sparkles */}
        <div className="absolute inset-0 pointer-events-none">
          <span className="absolute top-3 right-32 text-xs animate-float-up">✨</span>
          <span className="absolute top-6 right-12 text-xs animate-float-up" style={{ animationDelay: "0.8s" }}>⭐</span>
          <span className="absolute bottom-10 left-12 text-xs animate-float-up" style={{ animationDelay: "1.4s" }}>💫</span>
          <span className="absolute bottom-6 right-10 text-xs animate-float-up" style={{ animationDelay: "0.4s" }}>✨</span>
        </div>

        {/* Confetti layer for win/epic */}
        <Confetti active={scene.kind === "win" || scene.kind === "epic"} />
        {/* Rain layer for fail */}
        <TearRain active={scene.kind === "fail"} />

        {/* Main scene content (re-mounted on idx change → triggers animate-scene-in) */}
        <div
          key={sceneIdx + scene.kind + scene.caption}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 animate-scene-in px-4"
        >
          <SceneCharacters scene={scene} />
          <div className="text-sm sm:text-base text-white font-bold text-center drop-shadow-lg max-w-[90%]">
            {scene.caption}
          </div>
          {scene.model && scene.model !== "?" && (
            <div className="text-[10px] text-gray-300/80 font-mono">
              model: {scene.model}
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {scenes.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === sceneIdx ? "w-5 bg-white/80" : "w-1 bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Live stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <StatCard label="ส่งการบ้านรวม" value={animTotal} icon="📚" hex="#6366f1" />
        <StatCard label="ผ่าน" value={animSuccess} icon="🏆" hex="#34d399" />
        <StatCard label="ตก" value={animFail} icon="😭" hex="#f43e5e" />
        <StatCard
          label="เร็วเฉลี่ย"
          value={(stats.avgLatency / 1000).toFixed(1)}
          suffix="s"
          icon="⚡"
          hex="#fb923c"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon,
  hex,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: string;
  hex: string;
}) {
  return (
    <div
      className="glass rounded-xl px-3 py-2 flex items-center gap-2 border border-white/5 hover:border-white/20 transition-colors"
      style={{ borderLeftColor: hex, borderLeftWidth: 3 }}
    >
      <span className="text-lg">{icon}</span>
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[10px] text-gray-500 truncate">{label}</span>
        <span className="text-sm font-bold text-white tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
    </div>
  );
}
