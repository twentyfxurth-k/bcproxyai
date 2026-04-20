import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { revokeKey, setEnabled, invalidateVerifyCache } from "@/lib/gateway-keys";

export const dynamic = "force-dynamic";

const OWNER_EMAIL = (process.env.AUTH_OWNER_EMAIL ?? "").toLowerCase();

async function requireOwner() {
  if (!OWNER_EMAIL) return null;
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (email === OWNER_EMAIL) return null;
  return NextResponse.json({ error: "owner only" }, { status: 403 });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireOwner();
  if (denied) return denied;
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
  const denied = await requireOwner();
  if (denied) return denied;
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
