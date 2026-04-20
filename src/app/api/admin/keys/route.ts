import { NextRequest, NextResponse } from "next/server";
import { createKey, listKeys } from "@/lib/gateway-keys";

export const dynamic = "force-dynamic";

// Admin endpoints are gated in middleware (master Bearer key only).
// No session/OAuth — this handler only needs to read who's calling for audit.

function callerFromHeader(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Bearer ")) return null;
  const key = h.slice(7).trim();
  return key ? `key:${key.slice(0, 10)}…` : null;
}

export async function GET() {
  try {
    const keys = await listKeys();
    return NextResponse.json(keys);
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { label, expiresAt, notes } = body as { label?: string; expiresAt?: string; notes?: string };
    if (!label || typeof label !== "string" || label.trim().length === 0) {
      return NextResponse.json({ error: "label required" }, { status: 400 });
    }
    const createdBy = callerFromHeader(req);
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
      plaintext: created.plaintext,
      createdAt: created.createdAt,
      expiresAt: created.expiresAt,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  }
}
