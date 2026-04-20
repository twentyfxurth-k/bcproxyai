import { NextResponse } from "next/server";
import { verifyAllProviders } from "@/lib/worker/provider-verify";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await verifyAllProviders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 200) }, { status: 500 });
  }
}
