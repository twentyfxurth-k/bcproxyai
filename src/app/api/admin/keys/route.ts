import { NextRequest, NextResponse } from "next/server";
import { createKey, listKeys } from "@/lib/gateway-keys";
import { auth } from "../../../../../auth";
import { isOwnerEmail, hasOwners } from "@/lib/admin-emails";

export const dynamic = "force-dynamic";

// Allow either:
//   • Google OAuth session with an email in AUTH_OWNER_EMAIL, OR
//   • Bearer GATEWAY_API_KEY (master) — for automation / CI
//
// Middleware is the primary gate; this is a belt-and-suspenders check so
// the routes are safe when called server-to-server outside the middleware
// matcher (e.g. route handlers).
async function whoami(req: NextRequest): Promise<{ ok: true; label: string } | { ok: false }> {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const master = (process.env.GATEWAY_API_KEY ?? "").trim();
  if (bearer && master && bearer === master) return { ok: true, label: "master" };
  try {
    const session = (await auth()) as { user?: { email?: string | null } } | null;
    const email = session?.user?.email ?? "";
    if (email && isOwnerEmail(email)) return { ok: true, label: email };
  } catch { /* swallow — fall through to 401 */ }
  if (!hasOwners() && !master) return { ok: true, label: "local" };
  return { ok: false };
}

export async function GET(req: NextRequest) {
  const who = await whoami(req);
  if (!who.ok) return NextResponse.json({ error: "owner only" }, { status: 401 });
  try {
    const keys = await listKeys();
    return NextResponse.json(keys);
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const who = await whoami(req);
  if (!who.ok) return NextResponse.json({ error: "owner only" }, { status: 401 });
  try {
    const body = await req.json();
    const { label, expiresAt, notes } = body as { label?: string; expiresAt?: string; notes?: string };
    if (!label || typeof label !== "string" || label.trim().length === 0) {
      return NextResponse.json({ error: "label required" }, { status: 400 });
    }
    const created = await createKey({
      label: label.trim().slice(0, 80),
      createdBy: who.label,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      notes: notes?.slice(0, 500) ?? null,
    });
    return NextResponse.json({
      ok: true,
      id: created.id,
      keyPrefix: created.keyPrefix,
      label: created.label,
      plaintext: created.plaintext,
      createdAt: created.createdAt,
      expiresAt: created.expiresAt,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  }
}
