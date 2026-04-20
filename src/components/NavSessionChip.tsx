"use client";

import { useEffect, useState } from "react";

interface SessionResp {
  user?: { email?: string | null; name?: string | null };
  role?: string;
}

// Client-side session chip for the top nav. Fetches NextAuth's built-in
// /api/auth/session endpoint — no server component plumbing needed.
// Render a compact "Sign in" link if not authed, or email+role+sign-out if authed.
export function NavSessionChip() {
  const [session, setSession] = useState<SessionResp | null | "unconfigured">(null);
  useEffect(() => {
    fetch("/api/auth/session")
      .then(async (r) => {
        if (!r.ok) { setSession("unconfigured"); return; }
        const data = (await r.json()) as SessionResp;
        // NextAuth returns {} for anon; empty session
        setSession(data && Object.keys(data).length > 0 ? data : null);
      })
      .catch(() => setSession("unconfigured"));
  }, []);

  if (session === "unconfigured") return null;

  // Not logged in
  if (!session?.user?.email) {
    return (
      <a
        href="/login"
        className="px-3 py-1.5 rounded-lg text-xs text-indigo-300 hover:text-white hover:bg-white/5 transition-colors border border-indigo-500/40"
        title="เข้าสู่ระบบด้วย Google"
      >
        🔐 เข้าสู่ระบบ
      </a>
    );
  }

  const email = session.user.email;
  const role = session.role ?? "guest";
  const isAdmin = role === "owner";

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-200">
      <span
        className={`inline-block h-2 w-2 rounded-full ${isAdmin ? "bg-emerald-400" : "bg-amber-400"}`}
        title={isAdmin ? "Admin" : "Guest"}
      />
      <span className="font-mono max-w-[12rem] truncate">{email}</span>
      <span
        className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
          isAdmin ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
        }`}
      >
        {isAdmin ? "admin" : "guest"}
      </span>
      <a
        href="/api/auth/signout?callbackUrl=/"
        className="ml-0.5 text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded px-1"
        title="ออก"
      >
        ออก
      </a>
    </div>
  );
}
