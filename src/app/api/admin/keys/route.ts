import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { createKey, listKeys } from "@/lib/gateway-keys";

export const dynamic = "force-dynamic";

const OWNER_EMAIL = (process.env.AUTH_OWNER_EMAIL ?? "").toLowerCase();

// Owner-only guard. Middleware already blocks `/api/*` for non-owners in prod,
// but local dev (no OWNER_EMAIL set) bypasses middleware — so we re-check here.
async function requireOwner() {
  if (!OWNER_EMAIL) return null; // local: open
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (email === OWNER_EMAIL) return null;
  return NextResponse.json({ error: "owner only" }, { status: 403 });
}

export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    const keys = await listKeys();
    return NextResponse.json(keys);
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    const body = await req.json();
    const { label, expiresAt, notes } = body as { label?: string; expiresAt?: string; notes?: string };
    if (!label || typeof label !== "string" || label.trim().length === 0) {
      return NextResponse.json({ error: "label required" }, { status: 400 });
    }
    const session = await auth();
    const createdBy = session?.user?.email ?? null;
    const created = await createKey({
      label: label.trim().slice(0, 80),
      createdBy: createdBy ?? undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      notes: notes?.slice(0, 500) ?? null,
    });
    return NextResponse.json({
      ok: true,
      id: created.id,
      keyPrefix: created.keyPrefix,
      label: created.label,
      plaintext: created.plaintext, // shown ONCE
      createdAt: created.createdAt,
      expiresAt: created.expiresAt,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  }
}
