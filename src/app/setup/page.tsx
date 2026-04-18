"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface ProviderStatus {
  provider: string;
  label: string;
  envVar: string;
  homepage: string;
  source: string;
  freeTier: boolean;
  hasKey: boolean;
  hasDbKey: boolean;
  noKeyRequired: boolean;
  enabled: boolean;
  modelCount: number;
  availableCount: number;
  status: "active" | "no_key" | "no_models" | "error" | "disabled";
}

const PROVIDER_ICONS: Record<string, string> = {
  openrouter: "🌐", kilo: "⚡", google: "🔍",
  groq: "🏎️", cerebras: "🧠", sambanova: "🚀",
  mistral: "💨", ollama: "💻", github: "🐱",
  fireworks: "🎆", cohere: "📡", cloudflare: "☁️",
  huggingface: "🤗", nvidia: "🟢", chutes: "💨",
  llm7: "🔑", scaleway: "🇪🇺", pollinations: "🌸",
  ollamacloud: "☁️", siliconflow: "🔮", glhf: "🎮",
  together: "🤝", hyperbolic: "🌀", zai: "🗿",
  dashscope: "🧧", reka: "🌊",
  deepseek: "🐋", deepinfra: "📦", novita: "🌟",
  monsterapi: "👾", friendli: "🤟", xai: "𝕏",
  moonshot: "🌙", ai21: "🔣",
};

export default function SetupPage() {
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveResult, setSaveResult] = useState<Record<string, "ok" | "error">>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, { ok?: boolean; models?: number; error?: string } | undefined>>({});
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "no_key" | "free">("all");

  const fetchStatuses = useCallback(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setStatuses(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const handleTestKey = async (provider: string) => {
    const apiKey = keyInputs[provider]?.trim();
    if (!apiKey) return;
    setTesting((p) => ({ ...p, [provider]: true }));
    setTestResult((p) => ({ ...p, [provider]: undefined }));
    try {
      const res = await fetch("/api/setup/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await res.json();
      setTestResult((p) => ({ ...p, [provider]: data }));
    } catch {
      setTestResult((p) => ({ ...p, [provider]: { ok: false, error: "Network error" } }));
    } finally {
      setTesting((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleSaveKey = async (provider: string) => {
    const apiKey = keyInputs[provider]?.trim();
    if (!apiKey) return;
    setSaving((p) => ({ ...p, [provider]: true }));
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      if (res.ok) {
        setSaveResult((p) => ({ ...p, [provider]: "ok" }));
        setKeyInputs((p) => ({ ...p, [provider]: "" }));
        setTestResult((p) => ({ ...p, [provider]: undefined }));
        fetchStatuses();
      } else {
        setSaveResult((p) => ({ ...p, [provider]: "error" }));
      }
    } catch {
      setSaveResult((p) => ({ ...p, [provider]: "error" }));
    } finally {
      setSaving((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleToggleEnabled = async (provider: string, enabled: boolean) => {
    setSaving((p) => ({ ...p, [provider]: true }));
    try {
      await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, enabled }),
      });
      fetchStatuses();
    } catch { /* ignore */ }
    finally {
      setSaving((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleDeleteKey = async (provider: string) => {
    setSaving((p) => ({ ...p, [provider]: true }));
    try {
      await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: "" }),
      });
      fetchStatuses();
    } catch { /* ignore */ }
    finally {
      setSaving((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleScanNow = async () => {
    setScanning(true);
    try {
      await fetch("/api/worker", { method: "POST" });
      setTimeout(() => {
        fetchStatuses();
        setScanning(false);
      }, 3000);
    } catch {
      setScanning(false);
    }
  };

  const activeCount = statuses.filter((s) => s.status === "active").length;
  const noKeyCount = statuses.filter((s) => s.status === "no_key").length;
  const freeCount = statuses.filter((s) => s.freeTier).length;
  const canScan = statuses.some((s) => s.hasKey);

  const filtered = statuses.filter((s) => {
    if (filter === "active") return s.status === "active";
    if (filter === "no_key") return s.status === "no_key";
    if (filter === "free") return s.freeTier;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-gray-950/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            กลับหน้าหลัก
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <span>⚙️</span>
            <span>ตั้งค่า API Key</span>
          </h1>
          <span className="text-xs text-gray-500 hidden sm:inline">
            ใส่ API key ของ provider ที่อยากใช้ — ระบบ scan model ให้อัตโนมัติ
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className="text-emerald-400 font-bold">✓ {activeCount} ใช้ได้</span>
              <span className="text-amber-400">{noKeyCount} ยังไม่มี key</span>
            </div>
            <button
              onClick={handleScanNow}
              disabled={scanning || !canScan}
              title={!canScan ? "ใส่ key อย่างน้อย 1 provider ก่อน" : "Trigger worker scan model ทันที"}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                canScan
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/30"
                  : "bg-gray-700/50 text-gray-500 cursor-not-allowed"
              } disabled:opacity-60`}
            >
              {scanning ? "🔄 กำลัง Scan…" : "🔍 Scan ตอนนี้"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Quick start guide */}
        <section className="rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 to-cyan-500/5 p-4">
          <div className="text-sm font-bold text-indigo-300 mb-2">เริ่มต้นง่ายๆ 3 ขั้น (ฟรีทุก provider)</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none shrink-0">1️⃣</span>
              <span>กด <strong className="text-cyan-300">เปิดหน้าเว็บ</strong> ของ provider แล้วสมัครรับ API Key</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none shrink-0">2️⃣</span>
              <span>วาง key ในช่องแล้วกด <strong className="text-emerald-300">บันทึก</strong> (ทดสอบก่อนได้)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none shrink-0">3️⃣</span>
              <span>กด <strong className="text-amber-300">Scan ตอนนี้</strong> ที่มุมขวาบน → worker หา model ให้</span>
            </div>
          </div>
        </section>

        {/* Filter chips */}
        <section className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">กรอง:</span>
          {([
            { id: "all",     label: `ทั้งหมด (${statuses.length})` },
            { id: "active",  label: `✓ ใช้ได้ (${activeCount})` },
            { id: "no_key",  label: `🔑 ยังไม่มี key (${noKeyCount})` },
            { id: "free",    label: `🆓 free tier (${freeCount})` },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filter === f.id
                  ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/40"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </section>

        {/* Provider grid */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="shimmer rounded-xl h-32 bg-gray-800/60" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((st) => {
              const icon = PROVIDER_ICONS[st.provider] ?? "🌐";
              const isActive = st.status === "active";
              const isSaving = saving[st.provider] ?? false;
              const isTesting = testing[st.provider] ?? false;
              const testRes = testResult[st.provider];
              const testPassed = testRes?.ok === true;
              const result = saveResult[st.provider];

              let statusBadge: { text: string; cls: string };
              switch (st.status) {
                case "disabled":
                  statusBadge = { text: "ปิดเอง", cls: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
                  break;
                case "active":
                  statusBadge = { text: `${st.availableCount}/${st.modelCount} models`, cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
                  break;
                case "error":
                  statusBadge = { text: `${st.modelCount} models offline`, cls: "bg-red-500/20 text-red-300 border-red-500/30" };
                  break;
                case "no_models":
                  statusBadge = { text: "มี key — รอ scan", cls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" };
                  break;
                default:
                  statusBadge = { text: "ยังไม่มี key", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
              }

              return (
                <div
                  key={st.provider}
                  className={`rounded-xl p-4 border transition-all ${
                    !st.enabled ? "border-gray-600/20 bg-gray-800/20 opacity-60" :
                    isActive ? "border-emerald-500/30 bg-emerald-500/[0.03]" :
                    st.status === "error" ? "border-red-500/20 bg-red-500/[0.03]" :
                    "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-white/5 border border-white/10 text-2xl shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">{st.label}</span>
                        {st.freeTier && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">🆓 free</span>}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>{statusBadge.text}</span>
                        {result === "ok" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">บันทึกแล้ว!</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 font-mono truncate">
                        {st.envVar || st.provider}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleEnabled(st.provider, !st.enabled)}
                        disabled={isSaving}
                        title={st.enabled ? "ปิด provider" : "เปิด provider"}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                          st.enabled ? "bg-emerald-500/70" : "bg-gray-600/60"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          st.enabled ? "translate-x-4" : "translate-x-0.5"
                        }`} />
                      </button>
                      {st.homepage && (
                        <a href={st.homepage} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-300 hover:text-white whitespace-nowrap">
                          เปิดหน้าเว็บ →
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Key input row */}
                  {st.noKeyRequired ? (
                    <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      ไม่ต้องใช้ key — รันได้เลย
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          placeholder={st.hasKey ? "••••••••••••" : "วาง API Key ที่นี่..."}
                          value={keyInputs[st.provider] ?? ""}
                          onChange={(e) => {
                            setKeyInputs((p) => ({ ...p, [st.provider]: e.target.value }));
                            setTestResult((p) => ({ ...p, [st.provider]: undefined }));
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleTestKey(st.provider); }}
                          className="flex-1 min-w-0 text-xs font-mono bg-gray-900/80 border border-white/10 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                        />
                        <button
                          onClick={() => handleTestKey(st.provider)}
                          disabled={isTesting || !(keyInputs[st.provider]?.trim())}
                          className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {isTesting ? "..." : "ทดสอบ"}
                        </button>
                        <button
                          onClick={() => handleSaveKey(st.provider)}
                          disabled={isSaving || !testPassed}
                          title={!testPassed ? "ทดสอบให้ผ่านก่อนถึงจะบันทึกได้" : "บันทึก key"}
                          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSaving ? "..." : "บันทึก"}
                        </button>
                        {st.hasDbKey && (
                          <button
                            onClick={() => handleDeleteKey(st.provider)}
                            disabled={isSaving}
                            className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                            title="ลบ key จาก DB"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {testRes?.ok === true && (
                        <div className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                          ✓ ทดสอบผ่าน — เจอ {testRes.models ?? 0} models
                        </div>
                      )}
                      {testRes?.ok === false && (
                        <div className="text-[11px] text-red-300 flex items-center gap-1.5" title={testRes.error}>
                          ✗ ใช้ไม่ได้: {testRes.error?.slice(0, 80) ?? "unknown error"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-gray-500 text-sm py-12">ไม่มี provider ในกลุ่มนี้</div>
            )}
          </div>
        )}

        {/* Footer note */}
        <section className="rounded-xl border border-gray-500/20 bg-gray-500/5 p-4 text-xs text-gray-400 space-y-1">
          <div className="font-bold text-gray-300 mb-1">หมายเหตุ</div>
          <ul className="list-disc list-inside space-y-0.5">
            <li>API key ทั้งหมดเก็บใน database (<code className="text-indigo-300">api_keys</code> table) — ไม่อ่าน .env.local</li>
            <li>Provider list มาจาก DB (<code className="text-indigo-300">provider_catalog</code>) — รวม provider ที่ระบบ auto-discover จาก internet</li>
            <li>Toggle ปิด/เปิด provider ได้ — ปิดแล้วระบบจะไม่ route ไปที่นั่น</li>
            <li>ทุก provider ที่นี่มี endpoint direct ของตัวเอง — provider จาก OpenRouter aggregator ดูใน <Link href="/#provider-catalog" className="text-indigo-300 hover:text-white">Catalog panel</Link></li>
          </ul>
        </section>
      </main>
    </div>
  );
}
