import { NextRequest, NextResponse } from "next/server";
import { revokeKey, setEnabled, invalidateVerifyCache } from "@/lib/gateway-keys";

export const dynamic = "force-dynamic";

// Middleware already enforces master-Bearer on /api/admin/* — no extra check.

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  try {
    await revokeKey(n);
    invalidateVerifyCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  try {
    const { enabled } = (await req.json()) as { enabled?: boolean };
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
    }
    await setEnabled(n, enabled);
    invalidateVerifyCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  }
}
