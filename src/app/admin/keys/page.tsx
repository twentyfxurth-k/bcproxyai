"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface KeyRow {
  id: number;
  keyPrefix: string;
  label: string;
  createdBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  enabled: boolean;
  notes: string | null;
}

interface CreatedKey {
  id: number;
  keyPrefix: string;
  label: string;
  plaintext: string;
  createdAt: string;
  expiresAt: string | null;
}

const BEARER_KEY_STORAGE = "smlg.admin.bearer";

function bearerHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const k = sessionStorage.getItem(BEARER_KEY_STORAGE);
  return k ? { Authorization: `Bearer ${k}` } : {};
}

export default function AdminKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiBase, setApiBase] = useState("https://your-server/v1");
  const [bearerInput, setBearerInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") setApiBase(`${window.location.origin}/v1`);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(BEARER_KEY_STORAGE)) setAuthed(true);
  }, []);
  const [label, setLabel] = useState("");
  const [neverExpires, setNeverExpires] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(() => {
    if (!authed) { setLoading(false); return; }
    fetch("/api/admin/keys", { headers: bearerHeader() })
      .then(async (r) => {
        if (r.status === 401) {
          sessionStorage.removeItem(BEARER_KEY_STORAGE);
          setAuthed(false);
          setAuthErr("key ผิด — ลองใหม่");
          return null;
        }
        return r.json();
      })
      .then((d) => { if (Array.isArray(d)) setKeys(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authed]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleAuth = () => {
    const k = bearerInput.trim();
    if (!k) return;
    sessionStorage.setItem(BEARER_KEY_STORAGE, k);
    setAuthed(true);
    setAuthErr(null);
    setBearerInput("");
  };

  const handleLogout = () => {
    sessionStorage.removeItem(BEARER_KEY_STORAGE);
    setAuthed(false);
    setKeys([]);
  };

  const handleCreate = async () => {
    if (!label.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({
          label: label.trim(),
          expiresAt: neverExpires ? undefined : (expiresAt || undefined),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCreated(data);
        setLabel("");
        setExpiresAt("");
        setNeverExpires(true);
        setNotes("");
        fetchKeys();
      } else {
        alert("สร้างไม่สำเร็จ: " + (data.error ?? "unknown"));
      }
    } catch (err) {
      alert("network error: " + err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: number, label: string) => {
    if (!confirm(`ยกเลิก key "${label}" (id=${id})? \nผู้ถือ key จะใช้งานไม่ได้ทันที`)) return;
    await fetch(`/api/admin/keys/${id}`, { method: "DELETE", headers: bearerHeader() });
    fetchKeys();
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    await fetch(`/api/admin/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...bearerHeader() },
      body: JSON.stringify({ enabled: !enabled }),
    });
    fetchKeys();
  };

  const copyPlaintext = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.plaintext).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "—");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-gray-950/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-indigo-300 hover:text-white text-sm">&larr; Dashboard</Link>
          <h1 className="text-lg font-bold">🔑 API Keys (Admin)</h1>
          <span className="ml-auto text-xs text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">Master key</span>
          {authed && (
            <button onClick={handleLogout} className="text-[11px] text-gray-400 hover:text-white">ออก</button>
          )}
        </div>
      </header>

      {!authed ? (
        <main className="max-w-md mx-auto px-4 py-12 space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
            <div className="text-sm font-bold">🔐 ใส่ Master Key</div>
            <p className="text-xs text-gray-400 leading-relaxed">
              หน้านี้ต้องใช้ <code className="text-amber-300">GATEWAY_API_KEY</code> จาก <code>.env</code> ของเซิร์ฟเวอร์
              — key จะถูกเก็บเฉพาะใน sessionStorage ของ browser (ออกจาก tab = ต้องใส่ใหม่)
            </p>
            <input
              type="password"
              value={bearerInput}
              onChange={(e) => setBearerInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAuth(); }}
              placeholder="sk-gw-..."
              className="w-full font-mono text-sm bg-gray-900/80 border border-white/10 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
              autoFocus
            />
            <button
              onClick={handleAuth}
              disabled={!bearerInput.trim()}
              className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
            >
              เข้าสู่ระบบ
            </button>
            {authErr && <div className="text-xs text-red-300">✗ {authErr}</div>}
          </div>
        </main>
      ) : (
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* One-time reveal banner */}
        {created && (
          <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
            <div className="text-sm font-bold text-emerald-200">
              ✅ สร้าง key &quot;{created.label}&quot; สำเร็จ — แสดงครั้งเดียวเท่านั้น!
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-black/40 border border-white/10 rounded px-3 py-2 text-emerald-200 break-all">
                {created.plaintext}
              </code>
              <button
                onClick={copyPlaintext}
                className={`px-3 py-2 rounded text-xs font-bold ${copied ? "bg-emerald-500/30 text-emerald-200" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
              >
                {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
              </button>
            </div>
            <div className="text-[11px] text-amber-300">
              ⚠️ เก็บไว้ในที่ปลอดภัย — ระบบเก็บเฉพาะ hash ไม่สามารถดูย้อนหลังได้ ถ้าทำหาย ต้องสร้างใหม่
            </div>
            <button
              onClick={() => setCreated(null)}
              className="text-[11px] text-gray-400 hover:text-white"
            >
              ปิดกล่องนี้ (ซ่อน key ถาวร)
            </button>
          </section>
        )}

        {/* How to use */}
        <section className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.03] p-4 space-y-2">
          <div className="text-sm font-bold text-indigo-300">วิธีใช้ key กับ SMLGateway</div>
          <pre className="text-xs font-mono bg-black/40 border border-white/10 rounded p-3 overflow-x-auto text-gray-200">
{`# OpenAI SDK (Python/Node)
base_url = "${apiBase}"
api_key  = "sml_live_xxxxxxxxxxxx"

# cURL
curl ${apiBase}/chat/completions \\
  -H "Authorization: Bearer sml_live_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"sml/auto","messages":[{"role":"user","content":"สวัสดี"}]}'`}
          </pre>
          <div className="text-xs text-gray-400">
            ดูตัวอย่างทุก framework (LangChain, Hermes Agent, OpenClaw, …) ที่ <Link href="/guide" className="text-indigo-300 hover:underline">/guide</Link>
          </div>
        </section>

        {/* Create form */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="text-sm font-bold text-white">สร้าง key ใหม่</div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ชื่อ/label (เช่น 'ทีม CRM', 'jead-laptop')"
            maxLength={80}
            className="w-full text-sm bg-gray-900/80 border border-white/10 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={neverExpires}
                onChange={(e) => setNeverExpires(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-gray-900/80 text-indigo-500 focus:ring-indigo-500/30"
              />
              <span>ไม่หมดอายุ</span>
            </label>
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="text-xs text-gray-500">วันหมดอายุ:</span>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={neverExpires}
                min={new Date().toISOString().slice(0, 10)}
                className="text-sm bg-gray-900/80 border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-indigo-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="โน้ต (optional) — จดไว้ว่าใช้ที่ไหน เพื่ออะไร"
            rows={2}
            maxLength={500}
            className="w-full text-sm bg-gray-900/80 border border-white/10 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 resize-none"
          />
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={creating || !label.trim()}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {creating ? "กำลังสร้าง…" : "+ สร้าง key"}
            </button>
          </div>
        </section>

        {/* Keys list */}
        <section className="space-y-2">
          <div className="text-sm font-bold text-white">รายการ key ทั้งหมด ({keys.length})</div>
          {loading ? (
            <div className="h-32 rounded-xl bg-gray-800/40 animate-pulse" />
          ) : keys.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8">ยังไม่มี key — สร้างอันแรกด้านบน</div>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className={`rounded-lg border p-3 flex items-start gap-3 ${
                    k.enabled ? "border-white/10 bg-white/[0.02]" : "border-gray-600/20 bg-gray-800/20 opacity-60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{k.label}</span>
                      <code className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">{k.keyPrefix}…</code>
                      {!k.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">ปิดอยู่</span>}
                      {k.expiresAt && new Date(k.expiresAt) < new Date() && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">หมดอายุ</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 space-y-0.5">
                      <div>สร้าง: {fmt(k.createdAt)}{k.createdBy ? ` โดย ${k.createdBy}` : ""}</div>
                      <div>ใช้ล่าสุด: {fmt(k.lastUsedAt)}{k.expiresAt ? ` · หมดอายุ: ${fmt(k.expiresAt)}` : ""}</div>
                      {k.notes && <div className="text-gray-400 italic">{k.notes}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggle(k.id, k.enabled)}
                      title={k.enabled ? "ปิดชั่วคราว" : "เปิดใช้งาน"}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${k.enabled ? "bg-emerald-500/70" : "bg-gray-600/60"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${k.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                    <button
                      onClick={() => handleRevoke(k.id, k.label)}
                      title="ลบถาวร"
                      className="p-1.5 rounded text-red-400 hover:bg-red-500/10"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      )}
    </div>
  );
}
